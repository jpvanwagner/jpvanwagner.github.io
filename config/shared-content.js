/**
 * SHARED-CONTENT.JS - Content that appears on more than one page, kept in ONE place.
 *
 * Edit the HTML between the backticks (` `); every page that shows it updates, in both the
 * Traditional View and the Retro Desktop. A page shows a block with an empty placeholder:
 *     <div class="stats" data-shared="stats"></div>
 * (pages/js/layout.js fills it in; tools/build-search-index.py also reads this file so the
 * text stays searchable). Avoid the backtick character itself inside the HTML.
 *
 *   stats            the number boxes (Home, Resume)
 *   colleagueQuotes  "What colleagues say" (Home, About); one <blockquote> per quote
 *   whyLayout        "Why the strange layout?" note at the bottom (Home, About)
 *   studentQuotes    "From my students" (Home), one at a time in a random order; one <blockquote> per
 *                    quote. Initials only (no full names or years); "Student" when there's no name.
 */
window.SharedContent = {

    // The stat boxes. data-years-since="YYYY-MM" = whole years since then, updating itself every June.
    // Ordered experience > reach > results > speed > change > classroom.
    // class="stat-tip" tabindex="0" + a <div class="stat-pop"> inside = a stat with a pop-up explanation
    // (shows on hover, keyboard focus, or a tap; dotted underline on the label).
    stats: `
        <div class="stat"><strong><span data-years-since="2011-06">15</span>+</strong><span>years in education &amp; training</span></div>
        <div class="stat"><strong>16,200+</strong><span>frontline workers trained nationwide</span></div>
        <div class="stat"><strong>350+</strong><span>e-learning courses published</span></div>
        <div class="stat stat-tip" tabindex="0"><strong>96%+</strong><span>training completion rate</span>
            <div class="stat-pop" role="tooltip"><b>How it got there</b><ul>
                <li>Before 2021, with no LMS (paper sign-offs): around 60%</li>
                <li>2021 to 2023: the first LMS raised completions somewhat, but they weren&rsquo;t tracked consistently</li>
                <li>2024 onward: 96%+, with automated enrollments, reminders, and completion reporting</li>
            </ul></div></div>
        <div class="stat stat-tip" tabindex="0"><strong>$0.9&ndash;1M</strong><span>in legal exposure prevented</span>
            <div class="stat-pop" role="tooltip"><b>How I got there</b><ul>
                <li>A workforce that grew from ~6,500 to nearly 10,000 between 2023 and 2026 (~8,200 on average); 16,200+ people trained in all, counting everyone on staff in 2023, everyone hired since, and those who have since left</li>
                <li>Defending one employment claim: $75K+ in legal fees, even when the company wins (<a href="https://joinalliancerisk.com/employment-practices-liability-insurance-epli/" target="_blank" rel="noopener" title="Source, opens in a new tab">Alliance Risk</a>); ~$160K on average through settlement (<a href="https://www.hiscox.com/newsroom/press/hiscox-study-reveals-states-with-highest-employee-lawsuit-risk" target="_blank" rel="noopener" title="Source, opens in a new tab">Hiscox</a>)</li>
                <li>Harassment claim settled out of court: ~$50K on average (<a href="https://www.blgwins.com/average-eeoc-settlement-amount/" target="_blank" rel="noopener" title="Source, opens in a new tab">EEOC data</a>)</li>
                <li>Workplace injury: ~$47K per workers&rsquo; comp claim (<a href="https://injuryfacts.nsc.org/work/costs/workers-compensation-costs/" target="_blank" rel="noopener" title="Source, opens in a new tab">National Safety Council</a>); OSHA fines up to $16.5K per serious violation, $165K if willful (<a href="https://www.osha.gov/news/newsreleases/osha-trade-release/20250114" target="_blank" rel="noopener" title="Source, opens in a new tab">OSHA</a>)</li>
                <li>Officer use of force: $25K&ndash;150K for minor incidents, up to $3M+ for severe ones (<a href="https://bencrump.com/how-much-is-police-misconduct-settlement-worth/" target="_blank" rel="noopener" title="Source, opens in a new tab">Ben Crump Law</a>)</li>
                <li>Negligent security: median settlements of $1.1M (assault) and $1.6M (robbery) (<a href="https://barzakaylaw.com/blog/negligent-security-settlement-amounts/" target="_blank" rel="noopener" title="Source, opens in a new tab">Barzakay Law</a>)</li>
                <li>Expected exposure for a workforce this size: ~$2.7M over four years</li>
                <li>Training completion rose from ~60% to 96%+, so ~36% more of the workforce is now trained: ~$1M of that exposure prevented</li>
            </ul></div></div>
        <div class="stat stat-tip" tabindex="0"><strong>$5.5M</strong><span>in platform costs avoided</span>
            <div class="stat-pop" role="tooltip"><b>How I got there</b><ul>
                <li>16,200+ people have had a profile since 2023 (everyone on staff then, plus everyone hired since), but most who leave are deactivated and no longer billed</li>
                <li>Billed, active profiles followed headcount: ~6,500 in 2023, growing to ~9,800 in 2026 (about 32,600 profile-years in all)</li>
                <li>New enterprise suite: ~$500 per profile a year = ~$16.3M over four years</li>
                <li>Plus ~$3.3M to implement it for 6,500 users in 2023; setup typically runs 1 to 2.5 times the first year&rsquo;s license (<a href="https://vendorbenchmark.com/benchmarks/hr-human-capital-management-pricing-guide" target="_blank" rel="noopener" title="Source, opens in a new tab">VendorBenchmark</a>)</li>
                <li>Our existing systems: ~$430 per profile a year = ~$14M over four years, already in place</li>
                <li>~$19.6M vs. ~$14M: running on what we had until 2027 saved ~$5.5M, more than half of it in deferred setup fees</li>
            </ul></div></div>
        <div class="stat stat-tip" tabindex="0"><strong>$4.4&ndash;12.5K</strong><span>saved on design software every year</span>
            <div class="stat-pop" role="tooltip"><b>How I got there (per year, team of 4 to 5 designers)</b><ul>
                <li>Video editing: Descript Pro at ~$288 a year per designer (<a href="https://www.descript.com/pricing" target="_blank" rel="noopener" title="Source, opens in a new tab">Descript</a>) instead of Adobe Premiere and After Effects at ~$1,080 (<a href="https://www.adobe.com/creativecloud/business/teams/plans.html" target="_blank" rel="noopener" title="Source, opens in a new tab">Adobe</a>): $792 saved</li>
                <li>Screen recording: free, open-source ShareX (<a href="https://getsharex.com/" target="_blank" rel="noopener" title="Source, opens in a new tab">ShareX</a>) instead of Camtasia at ~$300 a year (<a href="https://www.techsmith.com/camtasia/pricing/" target="_blank" rel="noopener" title="Source, opens in a new tab">TechSmith</a>): $300 saved</li>
                <li>Together: $1,092 per designer a year, or $4,368&ndash;5,460 for the team</li>
                <li>With <a href="project-scenemaker.html" title="My branching-scenario authoring tool">Scenemaker</a> in place of Articulate 360 Teams at ~$1,400 a year (<a href="https://www.articulate.com/360/pricing/" target="_blank" rel="noopener" title="Source, opens in a new tab">Articulate</a>), the savings would grow to $2,492 per designer a year, or $9,968&ndash;12,460 for the team</li>
            </ul></div></div>
        <div class="stat stat-tip" tabindex="0"><strong>3x</strong><span>more e-courses built per designer with AI</span>
            <div class="stat-pop" role="tooltip"><b>How I got there (from our LMS course records)</b><ul>
                <li>Before AI tools (July 2023 to June 2024): ~12 new e-courses a month from a team of five, about 2.4 per designer</li>
                <li>With AI tools (from mid-2024): our fastest stretch, July to September 2026, produced 89 new e-courses, about 30 a month from a team of four, about 7.4 per designer</li>
                <li>Counts e-courses only, not instructor-led or live sessions</li>
            </ul></div></div>
        <div class="stat"><strong>1,200+</strong><span>students taught as a classroom teacher, in person, live online &amp; hybrid</span></div>
        <div class="stat"><strong>500+</strong><span>students tutored privately</span></div>
        <div class="stat"><strong>11%+</strong><span>student achievement gains, 3 years running</span></div>
        <div class="stat"><strong>155+</strong><span>educators and staff trained on new platforms</span></div>
        <div class="stat"><strong>1,700+</strong><span>students onboarded to Canvas</span></div>
        <div class="stat"><strong>100%</strong><span>Canvas adoption in month one</span></div>
    `,

    // Excerpts from LinkedIn recommendations; full text at linkedin.com/in/jpvanwagner
    colleagueQuotes: `
        <blockquote class="testimonial">
            <p>&ldquo;He is a trailblazer with the intentional and purposeful application of technology in the learning process. &hellip; He is simply a transformational educational leader whose colleagues adore him, students are inspired by him and leaders are consistently impressed by him.&rdquo;</p>
            <footer><strong>Sephali Thakkar, NBCT</strong>, Strategic Technology &amp; AI Advisor, T-Mobile</footer>
        </blockquote>
        <blockquote class="testimonial">
            <p>&ldquo;Mr. Joseph VanWagner is an exemplary leader and learner. Often, he would lead his teammates into &ldquo;outside the box&rdquo; thinking for innovative classroom projects and practices.&rdquo;</p>
            <footer><strong>Victoria Tong, Ed.D.</strong>, Assistant Principal, Frisco ISD</footer>
        </blockquote>
        <blockquote class="testimonial">
            <p>&ldquo;Mr. VanWagner brings energy, enthusiasm and creativity to his instructional delivery. Students are authentically engaged on a daily basis in his classroom.&rdquo;</p>
            <footer><strong>Anna Curtis, PhD</strong>, Assistant Director of Educator Certification, Tarleton State University</footer>
        </blockquote>
        <blockquote class="testimonial">
            <p>&ldquo;He does a wonderful job creating flexible, differentiated plans of instruction that meets the needs of individual students. He builds strong relationships with his students and maintains a fair, disciplined classroom in which students thrive.&rdquo;</p>
            <footer><strong>Ruth-Ellen Lagos</strong>, Support Services Specialist, Allen ISD</footer>
        </blockquote>
        <blockquote class="testimonial">
            <p>&ldquo;Joseph has a great rapport with students and is a quick problem solver. &hellip; He is very reliable and dependable as well as a great team player.&rdquo;</p>
            <footer><strong>Nettie Powell</strong>, Art Teacher and Student Council co-sponsor, Wylie ISD</footer>
        </blockquote>
        <blockquote class="testimonial">
            <p>&ldquo;He makes the content relevant to his students and adds a sense of humor and creativity to the classroom environment. I've seen him in action.&rdquo;</p>
            <footer><strong>Cath&eacute; Rhodes</strong>, Statewide Mentor and Trainer, Alaska Department of Education</footer>
        </blockquote>
        <blockquote class="testimonial">
            <p>&ldquo;I&rsquo;ve had the privilege to work with Joe several times during the North Texas Teen Book Festival. We&rsquo;re always delighted to have him volunteer with the event. He&rsquo;s reliable, helpful, and friendly. I know he will interact with guests with an excellent attitude and treat everyone with kindness. He&rsquo;s knowledgeable and willing to step in wherever help is needed.&rdquo;</p>
            <footer><strong>Gabi Sikes</strong>, Senior Library Assistant, Communications, City of Irving</footer>
        </blockquote>
    `,

    // Notes from students (plus a few parents and colleagues). Initials only, never full names or years.
    studentQuotes: `
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for your dedication to our success. I&rsquo;ve learned so much in your class, which you&rsquo;ve made such a welcoming environment. I appreciate how much you value students, their wellbeing, and their academic success.&rdquo;</p><footer>L.M., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being an awesome teacher and for making class a fun and funny learning environment.&rdquo;</p><footer>L.P., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I can&rsquo;t begin to explain how much I&rsquo;ve enjoyed being in your class. I am eternally grateful for everything you have taught me, but I am even more grateful for the conversations and deep, thought-provoking discussions we&rsquo;ve had. It was in those moments that I felt understood and challenged in class. Having IB-level discussions with you made me happy and helped me understand how my mind works a little more. Our conversations about writing made [me] more confident in my writing no matter how bad I think it is, and talking about my grievances and frustrations made me feel heard. Stay nerdy.&rdquo;</p><footer>T.F., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He teaches us English in a way that makes it enjoyable.&rdquo;</p><footer>S.T., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Super chill, but not too chill. Just the right amount of chill.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He makes me want to work harder in English.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He is positive and encouraging.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I am super grateful for your help and it&rsquo;s something I won&rsquo;t forget!&rdquo;</p><footer>E., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I love having you as my teacher. Class is so interesting with you around. You&rsquo;ve made English so fun!&rdquo;</p><footer>D.Y., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He makes English a little more tolerable and helps me when I&rsquo;m struggling.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I appreciate your love of everything YA! You are great to bounce ideas off of. I&rsquo;m glad to be working with you.&rdquo;</p><footer>V., colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are my favorite English teacher ever. You make the classroom so inviting, and I love being in your class. You&rsquo;re the reason my favorite day is B day! Thank you for being such an amazing person and teacher.&rdquo;</p><footer>P.J., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for an amazing year. I enjoyed our English class so much I would look forward to it every single day. The atmosphere was always kept so positive and every day brought something new. Thank you for always being so fun to be around and for always being so easy to talk to. Thank you for everything. I&rsquo;ll never forget this class.&rdquo;</p><footer>N.T., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I vibe your eccentricity in your teaching style.&rdquo;</p><footer>E.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for making a significant impact on my life. Myself and other students deeply appreciate your work ethic.&rdquo;</p><footer>N.Y., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are hilarious and witty! I admire how I can connect with you.&rdquo;</p><footer>A.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being my teacher. Your comical and thoughtfully entertaining style has made me appreciate English. Thank you for always making English fun and making English class awesome. Your kindness may seem simple to you, but it meant everything to me.&rdquo;</p><footer>N.L., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I appreciate all the help you gave me. I couldn&rsquo;t have done this without you.&rdquo;</p><footer>E.N., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I love how you make your class fun, creative, and inclusive of everyone&rsquo;s interests.&rdquo;</p><footer>H.A., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for always urging me to do what I need to succeed!&rdquo;</p><footer>S.F., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re the coolest teacher out there; you make every day insanely awesome.&rdquo;</p><footer>V., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being a kind and hilarious teacher.&rdquo;</p><footer>D.H., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being so nice, cool, and funky fresh in the classroom and online.&rdquo;</p><footer>Z.Z., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for hosting Write Club and giving me a safe space to write and share my work!&rdquo;</p><footer>E.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for keeping Connections interesting. I know our time was rough in the beginning, but I&rsquo;ve truly enjoyed all of our activities and hope we can do more. I am truly grateful for all that you do. Because of your lessons, I have become a more positive person.&rdquo;</p><footer>I.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I admire your commitment to your students and love that you are able to give them opportunities to enjoy writing.&rdquo;</p><footer>S.P., colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You really helped me survive High School. Thanks.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being awesome and always working hard to make the class more fun.&rdquo;</p><footer>C.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I&rsquo;ve never had a teacher as interested in music as you seem to be, and it&rsquo;s even cooler that you have a respectable collection of game OSTs. Thanks for everything!&rdquo;</p><footer>P.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I remember how you made your classroom a comfortable and friendly place to learn. You made things fun to learn and that helped a lot because English isn&rsquo;t exactly my favorite subject. Because of you, I felt prepared to move on. Thanks for being a cool guy on top of being a great teacher.&rdquo;</p><footer>C.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You always have a positive attitude!&rdquo;</p><footer>Z.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for coming up with interactive lessons to keep us engaged, for allowing collaboration, and thank you for making us laugh!&rdquo;</p><footer>B.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are an amazing teacher. I smile every time I enter your classroom.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You really inspired me to write! I wanted to thank you for dedicating your time to [teaching] (and especially for putting up with freshmen every year). You were one of the kindest teachers I had and one of the only ones who really cared not just what grades we got. Keep inspiring students like me.&rdquo;</p><footer>E.D., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re a cool teacher. You&rsquo;re very understanding and even though we may have gotten a lot of homework, there&rsquo;s usually room for creativity. You make class more fun and I like how much you try to get our feedback.&rdquo;</p><footer>S.M., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for just being an awesome teacher and Write Clubber!&rdquo;</p><footer>E.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;English has never been my favorite subject, but that&rsquo;s changed. You&rsquo;ve made it a fun journey!&rdquo;</p><footer>J.L., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for pushing me where I struggled. I do not know what I would have done without you.&rdquo;</p><footer>D., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re awesome and I hope you know it! English hasn&rsquo;t been my favorite class in the past but you make it fun.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being a great English teacher! Your class is exciting because of you.&rdquo;</p><footer>A.Z., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for being the coolest teacher, like, ever.&rdquo;</p><footer>A.Y., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for performing with us for our Spring Concert! Your rapping was awesome!&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are so awesome and weird, in a good way! You keep me interested in your class, and that&rsquo;s always a good thing.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You make class super fun and Write Club is the best club I&rsquo;ve ever been in!&rdquo;</p><footer>S.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for all that you have done for me. You are truly a fantastic teacher and a great role model. I appreciated the inclusivity of all belief systems and orientations; that really meant a lot to me.&rdquo;</p><footer>J.F., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Your class is my favorite!&rdquo;</p><footer>K.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for making English enjoyable and laughing with us. I really enjoyed your class. Thanks for being nice.&rdquo;</p><footer>R.V., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being the best English teacher I&rsquo;ve ever had.&rdquo;</p><footer>N.A., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being such a great teacher! Your jokes are really funny and I really look forward to your class. Your enthusiasm gets me excited for English!&rdquo;</p><footer>G.G., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I always look forward to your class to find out what fun activity you have planned for us. From Write Club to that one e-mail about plagiarism, you always go out of your way to ensure that your students have a positive learning environment.&rdquo;</p><footer>S.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;We wanted to let you know how much you mean to us. You are such a fun and wonderful teacher. Even if it&rsquo;s been a bad day, walking into your classroom brightens the day, especially when you wear a bow tie (bow ties are cool)!&rdquo;</p><footer>R.A., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re super cool and you have great music taste. I&rsquo;ve learned a lot and have so much fun in your class!&rdquo;</p><footer>V., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for your constant patience for all of our crazy questions, thank you for letting us talk and collaborate, and thank you for making class fun!&rdquo;</p><footer>B.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re my favorite teacher! You&rsquo;re funny, especially when you go into your nerdy Star Wars-mode. Thanks for giving us time to meditate, and just for being unique and chill.&rdquo;</p><footer>K.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being a great Phoenix teacher. I had a lot of fun in your class and learned a lot, and the memes and jokes were especially great!&rdquo;</p><footer>R.Z., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I want to thank you for all the help and support you have given me. I&rsquo;m so grateful!&rdquo;</p><footer>B.G., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for all your efforts. We&rsquo;re grateful for our son&rsquo;s success!&rdquo;</p><footer>L.R., parent</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for being my teacher. I especially enjoyed being a part of Write Club. I&rsquo;m definitely going to keep working on my story throughout the summer!&rdquo;</p><footer>E.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I appreciate how fast you get our work back to us and your teaching style is fun!&rdquo;</p><footer>M.T., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I think you&rsquo;re a really fun teacher and one of the best English teachers I&rsquo;ve had.&rdquo;</p><footer>S.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I think you&rsquo;re really swag. I&rsquo;d just like to say thank you for having your crap together in terms of organization and communication; I really appreciate it. I think you&rsquo;re really funny and relatable, even though you&rsquo;re like super intelligent. Thanks for helping me survive High School!&rdquo;</p><footer>A.K., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;To put it simply, you make English fun for me. You make English fun for everyone! I don&rsquo;t usually like English, but you make me look forward to it.&rdquo;</p><footer>Z.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are very approachable and fun to talk to. I don&rsquo;t like English much, but I really appreciate having such a caring teacher who inspires me to learn. You&rsquo;re very good at appealing to the younger generation and for that I envy you as it is not really a skill I have acquired yet.&rdquo;</p><footer>N.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being such a great teacher! You&rsquo;ve made class so much more entertaining while still educational.&rdquo;</p><footer>I.L., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for being my teacher and being so kind and helpful.&rdquo;</p><footer>A.J., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for an awesome year. I was hesitant to continue with advanced classes, but you made my decision to stay more than worthwhile! The impact you&rsquo;ve had on me will surely last.&rdquo;</p><footer>J.D., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for all the hard work you&rsquo;ve put into teaching us! The older I get, the less teachers seem to care about my education, and it&rsquo;s refreshing to have a teacher like you that makes class so educational, challenging, and relatable. Hearing stories about your life experiences and everything you&rsquo;ve done is so fascinating! Your class is my favorite part of the day.&rdquo;</p><footer>V., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for always sharing ideas and helping us with our technical difficulties. Write Club is a blast!&rdquo;</p><footer>L.M.</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re a kind and compassionate teacher, and you deserve it all!&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I am incredibly grateful to have had you as my teacher! Your passion for your subject is contagious, and you have helped foster my love for storytelling through Write Club. Thank you so much for all the help you&rsquo;ve given me in the college application process! It has been incredible to have your support throughout this journey, and I feel so much more optimistic about college decisions as a result. It has been wonderful maintaining contact. Even seeing updates for your class online, even though I haven&rsquo;t been there for years, brings me joy.&rdquo;</p><footer>S.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He&rsquo;s always so supportive of his students. When we have conflicts, he always understands and makes things work out for us.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He believes we&rsquo;re capable of things and pushes us to do our best, even if we don&rsquo;t believe it ourselves.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You make school such a welcoming place! Thanks for your awesomeness.&rdquo;</p><footer>S.O., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He has been everything! The driving force of Gifted & Talented, and he meets the needs of parents even at the crack of dawn.&rdquo;</p><footer>Parent</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for always making us laugh and telling us stories.&rdquo;</p><footer>L.M.</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for the impact you made on my life. I made so many interesting memories in your fun class.&rdquo;</p><footer>J.H., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being a teacher who understood his class and made it a fun and comfortable place. It really helped.&rdquo;</p><footer>D.O., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You help your students no matter what, have an amazing and uplifting attitude, and made what has always been my least favorite subject incredibly fun. Above all else, you told me about Hyper Light Drifter, and that game is a banger.&rdquo;</p><footer>P.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for always giving us thoughtful inquiries to ponder and for letting us be creative!&rdquo;</p><footer>B.D., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for making my High School experience so worth it. Simply being one of your students has brought me so much joy. I love our class so much! Thank you for always believing in us. You&rsquo;re the best!&rdquo;</p><footer>N.T., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for being a really cool teacher and keeping class fun and interesting!&rdquo;</p><footer>H., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being the coolest English teacher I ever had.&rdquo;</p><footer>N.K., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for allowing the Great Paper Feast. No other teacher would allow such delicacies to be consumed by students. Most hoard them, keeping it all for themselves. But you allowed us to consume our papers. Thank you. And also you teach good and such.&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re pretty chill for an English teacher, so, like&hellip;thanks!&rdquo;</p><footer>V.G., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for making English so entertaining and welcoming!&rdquo;</p><footer>A., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;The culture and climate of your class is refreshing and I can see why students appreciate going to a place and being themselves.&rdquo;</p><footer>V., colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I love coming to Write Club! You&rsquo;ve helped me to enjoy writing more in general.&rdquo;</p><footer>E.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Having you for an English teacher was great. I like that you&rsquo;re really cool and like video games like me!&rdquo;</p><footer>A.K., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for making me enjoy English (for the first time)!&rdquo;</p><footer>N.T., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for teaching me so much in English class! You&rsquo;re actually the coolest teacher that I&rsquo;ve ever had. Thank you for also helping me improve my writing and analysis skills.&rdquo;</p><footer>S.L., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being a wonderful teacher! You are always funny and enthusiastic and make mornings fun!&rdquo;</p><footer>E.Z., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re my favorite teacher here at this school, and I love going to your class. All the cool projects we have done and all the books we have read have been highlights for me. Thanks for being awesome!&rdquo;</p><footer>L.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;It&rsquo;s been super fun getting to know you. I just love your classroom setting and wall decor. I can see why your students enjoy coming to your class! I appreciate how welcoming you&rsquo;ve been. I feel like I belong here!&rdquo;</p><footer>L.M.</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for being an awesome teacher! Your communication says so much to the kids about what&rsquo;s important in life. Our daughter not only enjoys your class but has been very energized by going to Write Club!&rdquo;</p><footer>Parent</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I like having meditation time in class. It&rsquo;s not something I expected, and having even just a few minutes has really helped me to relax and focus for the day.&rdquo;</p><footer>N.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re my favorite teacher! You are so awesome and being in your class gives me joy. You make English class fun!&rdquo;</p><footer>D.Y., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You make English fun, and that&rsquo;s a talent.&rdquo;</p><footer>A.F., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He is willing to make things better for his students - lessons, ideas, plans&hellip; his lessons are interactive.&rdquo;</p><footer>Colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;When he gets a good idea, he is going to run with it and get everybody else excited about it, too!&rdquo;</p><footer>Colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;He connects with his Gifted and Talented kids because he is so similar to them; they understand one another.&rdquo;</p><footer>Colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Because of you, I have gained a liking for literature and writing. After reading in your class, I&rsquo;ve started reading more classics. My personal favorite is The Catcher in the Rye. I consider you the best English teacher I&rsquo;ve ever had because I have never learned as much as I did in your class, including my Dual Credit ones. Thank you for your commitment to teaching.&rdquo;</p><footer>C.A., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You ran me through the gauntlet, but you are an amazing teacher! You reminded me to put more effort into everything that I do. You are so cool, and everyone enjoys having you around!&rdquo;</p><footer>T.F., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I would like to thank you for always looking out for us and for being a wonderful teacher. Degree money well-used!&rdquo;</p><footer>V., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thanks for being such a reasonable teacher who knew when too much was too much for us. Thanks for understanding us and doing all you could to help out.&rdquo;</p><footer>W.D., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I really enjoyed your class, as I thought it had the right balance of cool stuff to work. All the discussion that was had in the class was thought-provoking and interesting, and I know we all appreciated the projects not being repetitive, but interesting for everyone. I really love your English class!&rdquo;</p><footer>M., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for the great time I had in your English class. I may not have been the best with academics (I&rsquo;m getting a little better) but the memes and jokes and fun times we had will be with me till death. So, thank you again for helping me survive.&rdquo;</p><footer>J.L., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re a really smart person who seems to genuinely like your job. You&rsquo;re probably the best English teacher I&rsquo;ve ever had!&rdquo;</p><footer>S.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re such a great English teacher and you really inspire me to work harder. Thank you for being so approachable and funny because it really helps me feel comfortable and happy.&rdquo;</p><footer>N.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I hope you never stop fighting; the system needs people like you to improve the reality for your team and for your students.&rdquo;</p><footer>S.P., colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I really appreciate your ability to make me smile and have fun in your class, even on rough days.&rdquo;</p><footer>D.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I can honestly say, without a doubt, you are the coolest teacher I&rsquo;ve ever had. You taught me so much more than just English, and the memories I&rsquo;ve made in your class will stick with me forever!&rdquo;</p><footer>V., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are so freaking amazing! You are such an inspiration to me and make my days the best. Truly, you inspire unicorns to be more magical (with your own magic)!&rdquo;</p><footer>Student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Your creative and quirky approach to teaching and storytelling is engaging and captivating to all of us. Thank you for letting your personality shine!&rdquo;</p><footer>S.T., colleague</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for making my favorite subject so fun and for giving honest, beneficial feedback on assignments. You&rsquo;re really cool!&rdquo;</p><footer>R., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for making English interesting and tranquil. You make the class something to look forward to.&rdquo;</p><footer>A.P., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for being understanding with late work and people needing to catch up.&rdquo;</p><footer>E., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being the best English teacher I could&rsquo;ve asked for.&rdquo;</p><footer>N.P., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;I like the way you make English class exciting, and your classroom looks pretty sick.&rdquo;</p><footer>E.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re a very good teacher. Thank you for making my days with you both entertaining and educational.&rdquo;</p><footer>I.L., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for being my teacher. You were always nice if I had a bad day and always treated me with respect, never patronizing. I felt free to express myself in your classroom and I plan to keep writing thanks to Write Club!&rdquo;</p><footer>R.W., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for always being so optimistic and willing to teach Gifted and Talented English every day. Thanks for hosting Write Club, too!&rdquo;</p><footer>A.S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You&rsquo;re still my favorite teacher. You actually inspired me to try and become a teacher, myself!&rdquo;</p><footer>S., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you so much for giving us creative freedom and encouragement!&rdquo;</p><footer>C.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You tell awesome stories and are the most supportive teacher I&rsquo;ve ever had. Thanks.&rdquo;</p><footer>A.B., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You are a fantastic teacher! I enjoyed all of the reading material we&rsquo;ve had. Thank you for everything you do! I appreciate that you are open to constructive criticism.&rdquo;</p><footer>R.R., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;You have such cool, chaotic energy and it makes being in your class such a fun experience because you genuinely give off &ldquo;Gifted and Talented kid&rdquo; vibes. It makes you easy to relate to and get to know.&rdquo;</p><footer>E.C., student</footer></blockquote>
        <blockquote class="ticker-item"><p>&ldquo;Thank you for being such a great teacher! You inspire me to be better. It&rsquo;s so cool to hear all your stories.&rdquo;</p><footer>G.G., student</footer></blockquote>
    `,

    // "Why the strange layout?" (bottom of Home and About)
    whyLayout: `
        <h2>Why the strange layout?</h2>
        <p>This site is a nod to the old web: hand-built homepages, personalized desktops (this one is yours to rearrange, too), and hit counters, back when the
           internet felt like a place you went. I consider it part of the &ldquo;small web,&rdquo; the
           return of personal sites (this one lives on Neocities) that are made by people instead of platforms.
           Mostly, though, it's here to show you who I am: curious, creative, and happiest when I'm building
           something people want to explore. Prefer something plainer? Switch between the
           <a href="../index.html?mode=retro" data-to-retro title="See this site as a retro desktop computer">Retro Desktop</a> and
           <a href="#traditional-view" data-to-classic title="See this site as a regular website">Traditional View</a> any time.</p>
    `
};
