# CareerQuest career compass — MVP survey

Version: careerquest-survey-1.0

Original exploration questionnaire. Not the Myers-Briggs or O*NET assessment; not a validated aptitude test.

For every statement: Strongly disagree / Disagree / Neutral / Agree / Strongly agree / Not sure yet.

Use examples from school, hobbies, projects, work, and everyday life. No résumé required.

## Interpersonal skills

Think about school, work, friendships, teams, or helping others.

1. I listen carefully when someone has a concern and check that I understand.

2. I can explain an idea in a way that helps someone else understand it.

3. I enjoy bringing people together to work toward a shared goal.

4. When people disagree, I try to understand both sides before responding.

5. I feel comfortable offering practical help to someone who is struggling.

## Intrapersonal skills

Think about how you respond to challenges, feedback, and responsibilities.

6. I can notice when I am stressed and take steps to manage it.

7. I usually follow through on responsibilities, even when the task is repetitive.

8. I can use constructive feedback to change how I approach a task.

9. I enjoy setting a goal and organizing the steps needed to reach it.

10. I am willing to keep investigating a problem when the answer is not obvious.

## Technical skills

Consider what you have practiced or would enjoy practicing. Experience is not required.

11. I enjoy working with numbers, spreadsheets, or data to understand a problem.

12. I enjoy learning how tools, machines, or physical systems work.

13. I am interested in understanding the human body and how to support health.

14. I enjoy comparing documents or sources and checking whether a claim is supported.

15. I enjoy creating instructions, demonstrations, or materials that help people learn.

## Personality & work preferences

Choose what feels like you today. There are no better or worse personalities.

16. I enjoy persuading others to support an idea, project, or initiative.

17. I prefer tasks with clear procedures and a well-defined chain of responsibility.

18. I enjoy trying new approaches when an existing way of doing something is not working.

19. I am drawn to work that improves how communities or public institutions function.

20. I enjoy practical tasks where I can see a concrete result of my work.

## Learning preferences

These are preferences, not fixed learning types. Different tasks may call for different approaches.

21. Reading a clear explanation or seeing a diagram helps me get started.

22. Watching someone demonstrate a task helps me understand it.

23. Trying a task myself and learning from mistakes helps me make progress.

24. Discussing a topic or explaining it to someone else helps me learn.

25. A structured course with milestones and feedback helps me stay on track.

## Location preferences

Describe the settings you prefer. These answers do not exclude any career category.

26. Staying close to my current community is important to me.

27. I would consider relocating for an opportunity that fits my goals.

28. I would prefer to do at least some of my work remotely.

29. I prefer smaller communities or rural settings over large cities.

30. I would enjoy a role that includes regular travel or changing work locations.

## Results and integration

Seven categories: Healthcare, Business, Education, Military, Law, Trades, and Political. Every category stays available. Selecting a category changes the illustrative role choices in the quest; it does not add confirmed skills to a character.

The first 20 items use explicit category weights in backend/app/data/survey.v1.json. For each category, the weighted mean of known ratings is rescaled from 1–5 to 0–100. Unknown answers are excluded; at least three relevant answers are needed for a score. The score is an internal heuristic, not a probability or ability measure.

Ranking requires at least 12 known responses among the first 20, seven available category scores, a maximum of at least 60, and a spread of at least 10. Otherwise categories appear alphabetically without a top match. Tied top scores receive the same label. Positive explanations quote up to three relevant answers rated 4 or 5, prioritized by weight.

Learning and location responses are displayed separately. They never change career rankings, assign a fixed learning type, or exclude careers. Personality questions describe work preferences, not diagnostic types.

Answers live in page memory and are submitted to POST /api/v1/survey/results. The endpoint does not persist them or call an AI provider and responds with Cache-Control: no-store. Users can download their report; refresh clears the session. Survey responses remain separate from the approved character schema.

John Business uses the user-supplied PNG, framed in CSS on the home page and survey. No personality or wealth preference is inferred from the mascot.

Before using these results for consequential advising, evaluate question comprehension and recommendation quality with representative students and workers. The MVP weights and thresholds are explicit design choices, not validated psychometric norms.
