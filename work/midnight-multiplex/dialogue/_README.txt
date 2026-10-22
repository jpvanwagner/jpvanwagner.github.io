midmulti/dialogue/
==================
The game's branching conversations live here, one file per conversation,
named <dialogueId>.json (e.g. usher_intro.json). None have been written yet.

WHERE CONVERSATIONS COME FROM
  Branching dialogue is authored in SCENEMAKER, Joe's separate scenario tool
  (github.com/Nostalginaut/Scenemaker). The old in-repo editor, Saymaker, was
  removed on 2026-10-10. Scenemaker saves projects as .vnproj (a zip holding
  project.json: scenes / lines / choices / outcomes). The game's dialogue
  runtime (core/dialogueRuntime.js) still reads the older Saymaker-style format
  (nodes / lines / choices / outcomes, with conditions, skill checks and camera
  moves), so the next step is teaching the game to read Scenemaker projects
  (docs/TODO.md, TOOL-6).

HOW A CONVERSATION GETS INTO A MAP (once a file exists)
  1. Save <id>.json into this folder.
  2. In Mapster, select an NPC or sign, and under "Branching Dialogue" click
     Import… and pick the .json. Then choose it in the dropdown to attach it
     (meta.dialogueFile = <id>).
  3. Preview or export the map. Interacting with that NPC/object plays the
     conversation via core/dialogueRuntime.js.

NOTE: Exported maps INLINE the referenced dialogue JSON into the .html (so they
work when opened directly from disk). This folder is the working library /
source of truth you import from; it does not need to ship alongside an
exported map.
