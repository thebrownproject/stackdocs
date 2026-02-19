Add an issue to the tracking file.

User's issue: $ARGUMENTS

Follow these steps:

1. Read `docs/plans/issues/ACTIVE.md` to see current format
2. Analyze the user's description and suggest the most likely category:
   - `bug` - Something broken
   - `deprecation` - Deprecated APIs/patterns to update
   - `tech-debt` - Code that works but should be improved
   - `feature` - Ideas for future functionality
3. Ask user to confirm: "This looks like a [category]. Add as `[category]`?" (one question only)
4. After confirmation:
   - Find the highest existing ticket number in ACTIVE.md
   - Increment by 1 for the new ticket number
   - Append: `- [ ] #{number} \`{category}\` {description} ({today's date})`
5. Confirm: "Added as #{number} to ACTIVE.md"
