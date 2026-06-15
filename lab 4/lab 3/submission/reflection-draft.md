# Reflection Draft

## 1. How did adding the comments change the LLM's explanation compared to using only the DIFF?
Adding the comments made the report more useful because the DIFF only showed what code changed, while the comments explained why the reviewers cared about certain details. For example, the code shows find widget integration, but the comments reveal UI concerns like padding, resize bar width, popped-out window behavior, and whether the find dialog should close after navigation. Without comments, the model would probably summarize the implementation but miss the review tradeoffs.

## 2. Did you struggle to get useful output? How did you overcome it?
Yes. A basic prompt produced a vague summary that did not separate technical changes from reviewer concerns. I improved it by giving the model a specific Senior Engineer role, separating the DIFF and comments with clear delimiters, and forcing the output into exact sections. I also made the prompt ask for severity ratings in the Risks section, which made the analysis more concrete.

## 3. Did the model correctly identify each stakeholder's stance?
Mostly yes. It correctly identified the author as the implementer and the reviewer as focused on UI behavior and edge cases. It also recognized automated participants like Copilot and the engineering bot. The weaker part is that bots do not have a real human stance, so the model needed to describe them as automation rather than reviewers with opinions.

## 4. How well did the Learning questions target the PR?
The Learning questions were useful because they focused on the actual architecture and tradeoffs in the PR, not generic GitHub questions. They made me think about why the code uses service boundaries, what user experience tradeoffs exist around navigation, and how to separate Chromium behavior from VS Code bugs.

## 5. What other issues did you face, and how did you overcome them?
The main issue was GitHub's unauthenticated rate limit. The tool includes the required User-Agent header and gives a clearer error if GitHub returns 403. Another issue was large diffs, so I added a 95,000 character truncation limit and a warning message to protect the LLM token budget.
