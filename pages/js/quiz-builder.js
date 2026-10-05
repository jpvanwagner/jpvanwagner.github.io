/**
 * QUIZ-BUILDER.JS - "Make your own quiz game!" on the game pages (pages/project-game-*.html).
 *
 * Visitors type multiple-choice questions (2 to 4 answer choices each, a radio button marks the
 * right one), then "Build my game" makes a complete, single-file copy of the game with THEIR
 * questions in it: shown in a code box to copy, or saved as .html / .txt. The copy plays offline
 * (double-click the file) and can be hosted on any website. "Test it here" loads it into the game
 * frame on the page.
 *
 * Markup:  <div data-quiz-builder="quiz-man" data-title="Quiz-Man"></div>   (id = folder in /games/)
 * The questions are swapped into the game's own question list (masterQuestionPool in the three
 * arcade games, RAW_QUESTIONS in Mall Run), with plain-English notes in the code explaining how to
 * add more. A visitor's draft is kept in their own browser (localStorage) until they clear it.
 */
(function () {
    var MAX_Q = 20, MIN_A = 2, MAX_A = 4;
    var SITE = 'https://jvanwagner.neocities.org/';
    var LETTERS = ['A', 'B', 'C', 'D'];

    function blankQuestion() { return { q: '', answers: ['', ''], correct: 0 }; }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // A safe JavaScript string for inside the game's <script> (quotes, line breaks, "</script>")
    function jsStr(s) { return JSON.stringify(String(s).trim()).replace(/<\//g, '<\\/'); }

    function setup(root) {
        var gameId = root.getAttribute('data-quiz-builder');
        var title = root.getAttribute('data-title') || gameId;
        var storeKey = 'quiz-builder-' + gameId;
        var questions;
        try { questions = JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (e) {}
        if (!Array.isArray(questions) || !questions.length) questions = [blankQuestion()];

        root.classList.add('qb');
        root.innerHTML =
            '<div class="qb-list"></div>' +
            '<p class="qb-limit" role="status" hidden></p>' +
            '<div class="qb-actions">' +
              '<button type="button" class="btn primary qb-build" title="Check your questions and make the game">Build my game</button>' +
              '<button type="button" class="btn qb-clear" title="Start over with one empty question">Start over</button>' +
              '<span class="qb-count"></span>' +
            '</div>' +
            '<p class="qb-errors" role="alert" hidden></p>' +
            '<div class="qb-output" hidden>' +
              '<p class="qb-done"><strong>Your game is ready!</strong> Save it as a file and double-click it to play, share it, ' +
              'or put it on your own website. Want more than ' + MAX_Q + ' questions? The notes inside the code show exactly where to add as many as you like.</p>' +
              '<div class="btn-row">' +
                '<button type="button" class="btn primary qb-test" title="Load your version into the game above">Test it here</button>' +
                '<button type="button" class="btn qb-copy" title="Copy all of the code">Copy code</button>' +
                '<button type="button" class="btn qb-save-html" title="Save a file you can double-click to play">Save as .html</button>' +
                '<button type="button" class="btn qb-save-txt" title="Save the code as a plain text file">Save as .txt</button>' +
              '</div>' +
              '<label class="qb-code-label">Your game\'s code<textarea class="qb-code" readonly spellcheck="false" rows="12" aria-label="Your game\'s code"></textarea></label>' +
            '</div>';

        var list = root.querySelector('.qb-list');
        var limitNote = root.querySelector('.qb-limit');
        var errors = root.querySelector('.qb-errors');
        var out = root.querySelector('.qb-output');
        var code = root.querySelector('.qb-code');

        function save() { try { localStorage.setItem(storeKey, JSON.stringify(questions)); } catch (e) {} }

        function render() {
            list.innerHTML = '';
            questions.forEach(function (item, qi) {
                var card = document.createElement('fieldset');
                card.className = 'qb-q';
                var ans = item.answers.map(function (a, ai) {
                    return '<div class="qb-ans">' +
                        '<input type="radio" name="qb-' + gameId + '-' + qi + '" value="' + ai + '"' + (item.correct === ai ? ' checked' : '') +
                        ' title="Mark ' + LETTERS[ai] + ' as the right answer" aria-label="' + LETTERS[ai] + ' is the right answer">' +
                        '<span class="qb-letter">' + LETTERS[ai] + '</span>' +
                        '<input type="text" class="qb-a" data-ai="' + ai + '" maxlength="80" value="' + esc(a) + '" placeholder="Answer choice ' + LETTERS[ai] + '">' +
                        (item.answers.length > MIN_A ? '<button type="button" class="qb-x" data-act="del-a" data-ai="' + ai + '" title="Remove this answer choice" aria-label="Remove answer ' + LETTERS[ai] + '">&times;</button>' : '') +
                    '</div>';
                }).join('');
                card.innerHTML =
                    '<legend>Question ' + (qi + 1) + '</legend>' +
                    (questions.length > 1 ? '<button type="button" class="qb-del-q" data-act="del-q" title="Remove this question">Remove</button>' : '') +
                    '<label class="qb-label">Question<textarea class="qb-qtext" rows="2" maxlength="200" placeholder="Type your question here">' + esc(item.q) + '</textarea></label>' +
                    '<div class="qb-label">Answer choices <small>(2 to 4; click the circle next to the right one)</small></div>' +
                    ans +
                    (item.answers.length < MAX_A ? '<button type="button" class="qb-add-a" data-act="add-a" title="Add another answer choice (up to 4)">+ Add an answer choice</button>' : '') +
                    '<button type="button" class="btn qb-add-q" data-act="add-q" title="Add a new question right after this one">+ Add a question</button>';
                card.dataset.qi = qi;
                list.appendChild(card);
            });
            root.querySelector('.qb-count').textContent = questions.length + ' of ' + MAX_Q + ' questions';
        }

        // Typing and choosing (no re-render, so the cursor stays put)
        list.addEventListener('input', function (e) {
            var card = e.target.closest('.qb-q'); if (!card) return;
            var item = questions[+card.dataset.qi];
            if (e.target.classList.contains('qb-qtext')) item.q = e.target.value;
            else if (e.target.classList.contains('qb-a')) item.answers[+e.target.dataset.ai] = e.target.value;
            save();
        });
        list.addEventListener('change', function (e) {
            if (e.target.type !== 'radio') return;
            questions[+e.target.closest('.qb-q').dataset.qi].correct = +e.target.value;
            save();
        });
        // Buttons inside the question cards
        list.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-act]'); if (!btn) return;
            var qi = +btn.closest('.qb-q').dataset.qi, item = questions[qi], act = btn.dataset.act;
            limitNote.hidden = true;
            if (act === 'add-q') {
                if (questions.length >= MAX_Q) {
                    limitNote.textContent = 'That\'s the most this builder holds (' + MAX_Q + ' questions). Build your game anyway: ' +
                        'the code it makes has notes showing exactly where to paste in as many more questions as you like.';
                    limitNote.hidden = false;
                    return;
                }
                questions.splice(qi + 1, 0, blankQuestion());
                save(); render();
                var next = list.querySelectorAll('.qb-qtext')[qi + 1]; if (next) next.focus();
                return;
            }
            if (act === 'del-q' && questions.length > 1) questions.splice(qi, 1);
            if (act === 'add-a' && item.answers.length < MAX_A) item.answers.push('');
            if (act === 'del-a' && item.answers.length > MIN_A) {
                var ai = +btn.dataset.ai;
                item.answers.splice(ai, 1);
                if (item.correct === ai) item.correct = 0; else if (item.correct > ai) item.correct--;
            }
            save(); render();
        });

        root.querySelector('.qb-clear').addEventListener('click', function () {
            if (!confirm('Start over? This clears all of your questions.')) return;
            questions = [blankQuestion()]; save(); render();
            out.hidden = true; errors.hidden = true; limitNote.hidden = true;
        });

        // Make sure every question is complete before building
        function check() {
            var problems = [];
            questions.forEach(function (item, i) {
                var filled = item.answers.filter(function (a) { return a.trim(); }).length;
                if (!item.q.trim()) problems.push('Question ' + (i + 1) + ' needs a question.');
                if (filled < item.answers.length) problems.push('Question ' + (i + 1) + ' has an empty answer choice (fill it in or remove it).');
                if (filled < MIN_A) problems.push('Question ' + (i + 1) + ' needs at least 2 answer choices.');
            });
            return problems;
        }

        var built = '';
        root.querySelector('.qb-build').addEventListener('click', function () {
            var problems = check();
            errors.hidden = !problems.length;
            errors.innerHTML = problems.map(esc).join('<br>');
            if (problems.length) { out.hidden = true; return; }
            fetch('../games/' + gameId + '/index.html', { cache: 'no-cache' })
                .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
                .then(function (src) {
                    built = makeGame(src, gameId, title, questions);
                    code.value = built;
                    out.hidden = false;
                    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                })
                .catch(function () {
                    errors.hidden = false;
                    errors.textContent = 'Sorry, the game file couldn\'t be loaded just now. Please try again in a moment.';
                });
        });

        root.querySelector('.qb-copy').addEventListener('click', function (e) {
            var b = e.currentTarget;
            function done() { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy code'; }, 1500); }
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(built).then(done, function () { code.select(); document.execCommand('copy'); done(); });
            else { code.select(); document.execCommand('copy'); done(); }
        });
        function download(ext, type) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([built], { type: type }));
            a.download = 'my-' + gameId + '.' + ext;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }
        root.querySelector('.qb-save-html').addEventListener('click', function () { download('html', 'text/html'); });
        root.querySelector('.qb-save-txt').addEventListener('click', function () { download('txt', 'text/plain'); });

        // Load the built game into the game frame on this page, with a way back to the original
        root.querySelector('.qb-test').addEventListener('click', function () {
            var frame = document.querySelector('.game-frame iframe');
            if (!frame) return;
            frame.removeAttribute('src');
            frame.srcdoc = built;
            var box = frame.closest('.game-frame');
            var back = document.getElementById('qb-back');
            if (!back) {
                back = document.createElement('p');
                back.id = 'qb-back'; back.className = 'course-note';
                back.innerHTML = 'Playing <strong>your</strong> questions. <a href="#" title="Go back to the original game">Switch back to the original game</a>';
                box.parentNode.insertBefore(back, box.nextSibling);
                back.querySelector('a').addEventListener('click', function (ev) {
                    ev.preventDefault();
                    frame.removeAttribute('srcdoc');
                    frame.src = '../games/' + gameId + '/index.html';
                    back.remove();
                });
            }
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        render();
    }

    /** Swap the visitor's questions into the game's own source code, with notes for editing it later. */
    function makeGame(src, gameId, title, questions) {
        var top = '<!--\n' +
            '  YOUR OWN COPY OF ' + title.toUpperCase() + ', a quiz game by Joe VanWagner (' + SITE + ')\n' +
            '  Made with the quiz builder on his portfolio. Save this file with a name ending in .html,\n' +
            '  then double-click it to play in any web browser; no internet needed. You can also upload it\n' +
            '  to your own website. To change or add questions, open it in a plain text editor (Notepad,\n' +
            '  TextEdit, VS Code...) and search for "YOUR QUESTIONS".\n' +
            '-->\n';
        var notes = function (indent, fields) {
            return indent + '/* ==================== YOUR QUESTIONS ====================\n' +
                indent + '   Made with the quiz builder at ' + SITE + '\n' +
                indent + '   Each line below is one question:\n' + fields +
                indent + '   TO ADD MORE: copy any line, paste it on a new line right below it, and change the words.\n' +
                indent + '   Keep the quotes around the words and the comma at the end of every line. Add as many\n' +
                indent + '   questions as you like; there\'s no limit. Each question can have 2, 3 or 4 answer choices.\n' +
                indent + '   ========================================================= */\n';
        };
        var out;
        if (gameId === 'mall-run') {
            var rows = questions.map(function (q) {
                return '  { q:' + jsStr(q.q) + ', a:[' + q.answers.map(jsStr).join(', ') + '], c:' + q.correct + ' },';
            }).join('\n');
            var start = src.indexOf('var RAW_QUESTIONS=[');
            var end = src.indexOf('\n];', start) + 3;
            var hStart = src.indexOf('var HARD_QUESTIONS=[', end);
            var hEnd = src.indexOf('\n];', hStart) + 3;
            if (start < 0 || hStart < 0) throw new Error('question list not found');
            out = src.slice(0, start) +
                notes('', '     q = the question\n     a = the answer choices, in quotes, separated by commas\n' +
                          '     c = which choice is right, counting from 0 (0 = first, 1 = second, 2 = third, 3 = fourth)\n') +
                'var RAW_QUESTIONS=[\n' + rows + '\n];' +
                src.slice(end, hStart) +
                '// Hard mode uses the same questions. To give it its own, harder set, replace RAW_QUESTIONS below\n' +
                '// with a list just like the one above.\n' +
                'var HARD_QUESTIONS=RAW_QUESTIONS;' +
                src.slice(hEnd);
        } else {
            var qrows = questions.map(function (q) {
                return '        { q: ' + jsStr(q.q) + ', opts: [' + q.answers.map(jsStr).join(', ') + '], ans: ' + q.correct + ' },';
            }).join('\n');
            var s = src.indexOf('    const masterQuestionPool = [');
            var e = src.indexOf('\n    ];', s) + 7;
            if (s < 0) throw new Error('question list not found');
            out = src.slice(0, s) +
                notes('    ', '       q    = the question\n       opts = the answer choices, in quotes, separated by commas\n' +
                              '       ans  = which choice is right, counting from 0 (0 = first, 1 = second, 2 = third, 3 = fourth)\n') +
                '    const masterQuestionPool = [\n' + qrows + '\n    ];' +
                src.slice(e);
        }
        return out.replace(/^<!DOCTYPE html>\n?/i, '<!DOCTYPE html>\n' + top);
    }

    function init() { document.querySelectorAll('[data-quiz-builder]').forEach(setup); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
