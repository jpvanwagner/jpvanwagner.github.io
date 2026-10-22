/*
 * One shift of play. Owns the simulation state and wires the systems
 * together. A new Game is created for every shift (retry / next level); the
 * static world (stage, nav grid) is shared across shifts.
 *
 * Systems talk to each other through this object (game.desk, game.escorts...)
 * and to the UI only through game.bus events.
 */
import { resolveSettings } from '../config/settings.js';
import { shiftDurationSeconds } from './clock.js';
import { SpotRegistry } from '../nav/SpotRegistry.js';
import { NamePool } from './namePool.js';
import { AppointmentBook } from '../systems/AppointmentBook.js';
import { PersonState } from '../entities/Person.js';
import { careerCompany, careerDate, saveCareer } from './career.js';
import { ParkingSystem } from '../systems/ParkingSystem.js';
import { VerificationSystem } from '../systems/VerificationSystem.js';
import { RestroomSystem } from '../systems/RestroomSystem.js';
import { formatDate } from '../systems/credentials.js';
import { createLogoDecal } from '../world/meshes.js';
import { TutorialSystem } from '../systems/TutorialSystem.js';
import { DoorSystem } from '../systems/DoorSystem.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { IncidentSystem } from '../systems/IncidentSystem.js';
import { QueueSystem } from '../systems/QueueSystem.js';
import { DeskSystem } from '../systems/DeskSystem.js';
import { WaitingAreaSystem } from '../systems/WaitingAreaSystem.js';
import { EscortSystem } from '../systems/EscortSystem.js';
import { WanderSystem } from '../systems/WanderSystem.js';
import { StaffSystem } from '../systems/StaffSystem.js';
import { ArrivalSystem } from '../systems/ArrivalSystem.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { OfficerRoutineSystem } from '../systems/OfficerRoutineSystem.js';
import { PatrolSystem } from '../systems/PatrolSystem.js';

export class Game {
  /**
   * @param {object} deps
   * @param {import('../world/Stage.js').Stage} deps.stage
   * @param {import('../world/CameraRig.js').CameraRig} deps.rig
   * @param {Map} deps.cameraDevices
   * @param {import('../nav/NavGrid.js').NavGrid} deps.nav
   * @param {import('./EventBus.js').EventBus} deps.bus
   * @param {object} deps.level  entry from config/levels.js
   * @param {object} deps.career persistent employer / day / roster (core/career.js)
   * @param {object} [deps.double] { calledOff: name } - someone called off: a 16-hour double
   */
  constructor({ stage, rig, cameraDevices, nav, bus, level, career, double = null }) {
    this.stage = stage;
    this.nav = nav;
    this.bus = bus;
    this.level = level;
    this.features = { ...level.features }; // a copy: the tutorial switches features on as it goes
    this.settings = resolveSettings(level);
    this.double = double;
    if (double) this.settings.SHIFT_LENGTH_MINUTES = this.settings.DOUBLE_SHIFT_MINUTES;
    this.career = career;
    this.company = careerCompany(career);
    this.date = careerDate(career); // today's date (badges expire against it)
    this.renewals = []; // staff let in on a temp badge who still need a new badge

    this.time = 0; // simulation seconds since 07:00
    this.paused = false;
    this.ended = false;
    this.people = [];
    this.spots = new SpotRegistry();
    this.names = new NamePool(); // no repeated names within a shift
    career.roster.forEach((m) => this.names.claim(m.name)); // visitors never share a staff name
    this.appointments = new AppointmentBook(this.names, {
      size: this.settings.APPOINTMENT_LIST_SIZE,
      startMinutes: this.settings.SHIFT_START_MINUTES,
      lengthMinutes: this.settings.SHIFT_LENGTH_MINUTES,
      hosts: career.roster.filter((m) => m.type === 'E'),
    });

    // Order matters only for construction-time cross references.
    this.score = new ScoreSystem(this);
    this.incidents = new IncidentSystem(this);
    this.doors = new DoorSystem(this);
    this.parking = new ParkingSystem(this);
    const decal = createLogoDecal(this.company, 8); // the employer's logo on the lobby floor
    decal.position.set(17, 0.03, 28.4);
    stage.dynamicRoot.add(decal);
    this.cameras = new CameraSystem(this, rig, cameraDevices);
    this.queue = new QueueSystem(this);
    this.desk = new DeskSystem(this);
    this.waiting = new WaitingAreaSystem(this);
    this.escorts = new EscortSystem(this);
    this.wander = new WanderSystem(this);
    this.staff = new StaffSystem(this);
    this.arrivals = new ArrivalSystem(this);
    this.officerRoutine = new OfficerRoutineSystem(this);
    this.patrols = new PatrolSystem(this);
    this.verification = new VerificationSystem(this);
    this.restrooms = new RestroomSystem(this);
    this.tutorial = level.tutorial ? new TutorialSystem(this) : null;

    // Update order each tick.
    this.systems = [
      this.parking,
      this.arrivals,
      this.queue,
      this.desk,
      this.verification,
      this.waiting,
      this.escorts,
      this.restrooms,
      ...(this.tutorial ? [this.tutorial] : []),
      this.patrols,
      this.officerRoutine,
      this.wander,
      this.staff,
      this.incidents,
    ];
  }

  get shiftLength() {
    return shiftDurationSeconds(this.settings);
  }

  addPerson(person) {
    this.people.push(person);
  }

  /** Remove a person from the world entirely. */
  despawn(person) {
    if (person.removed) return;
    this.spots.releaseAll(person);
    person.dispose();
    this.people = this.people.filter((p) => p !== person);
    this.bus.emit('officers');
  }

  /** Send someone home: back to their car (or off the edge of the map), then despawn. */
  leave(person) {
    this.spots.releaseAll(person);
    person.unfollow();
    person.state = PersonState.LEAVING;
    person.status = '';
    person.tetherTo = null;
    this.parking.depart(person);
  }

  /** reason: 'player' (pause screen), 'briefing' (level intro), 'auto' (tab hidden / scrolled away). */
  setPaused(paused, reason = 'player') {
    if (this.ended) return;
    this.paused = paused;
    this.bus.emit('pause', { paused, reason });
  }

  update(dt) {
    if (this.paused || this.ended) return;
    this.time += dt;
    for (const system of this.systems) system.update(dt);

    // Leaders move before followers so formations don't lag a frame.
    for (const p of this.people) if (!p.leader) p.update(dt);
    for (const p of this.people) if (p.leader) p.update(dt);
    this.doors.update(dt);

    if (this.time >= this.shiftLength) this.end();
  }

  end() {
    if (this.ended) return;
    // Expired badges you never re-printed count against you.
    for (const r of this.renewals) {
      this.score.count('badgesNotRenewed');
      this.score.add(this.settings.SCORE.BADGE_NOT_RENEWED, `No new badge for ${r.name}`);
    }
    saveCareer(this.career);
    this.ended = true;
    this.cameras.exit();
    this.bus.emit('shift:end', { summary: this.summary() });
  }

  summary() {
    return {
      level: this.level,
      company: this.company,
      date: formatDate(this.date),
      day: this.career.day,
      double: !!this.double,
      score: this.score.total,
      stats: { ...this.score.stats },
      grade: this.score.grade(),
    };
  }

  /** Tear down dynamic objects before the next shift starts. */
  dispose() {
    this.ended = true;
    for (const p of [...this.people]) p.dispose();
    this.people = [];
    this.doors.reset();
    this.cameras.reset();
    this.stage.clearDynamic();
  }
}
