"""
Spike test: Phase 2.2 - Cross-Process Session Resume

Purpose: Verify session can be resumed from a saved session_id.
Run twice:
  1. python spikes/spike_resume.py          # Creates session, saves ID
  2. python spikes/spike_resume.py resume   # Resumes session, tests memory

Run with: cd backend && source venv/bin/activate && python spikes/spike_resume.py

See: planning/agent-sdk/Migration-Tasks.md - Phase 2
"""

import sys
import anyio
from pathlib import Path
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ResultMessage,
    SystemMessage,
)

# Store session ID in a file to persist across runs
SESSION_FILE = Path(__file__).parent / "spike_session_id.txt"


async def create_session():
    """First run: create a session, establish context, and save the session ID."""
    print("=" * 60)
    print("PHASE 2.2: Creating New Session")
    print("=" * 60)
    print()

    session_id = None
    response_text = []

    options = ClaudeAgentOptions(
        max_turns=1,
        system_prompt="You are a helpful assistant. Remember information exactly as given.",
    )

    print('Sending: "Remember: The secret code is ALPHA-7. Confirm you have it."')
    print()

    try:
        async for message in query(
            prompt="Remember: The secret code is ALPHA-7. This is very important. Please confirm you have stored it.",
            options=options
        ):
            msg_type = type(message).__name__
            print(f"[{msg_type}]")

            if isinstance(message, SystemMessage):
                print(f"  Subtype: {message.subtype}")
                if message.data and 'session_id' in message.data:
                    print(f"  Session ID (from init): {message.data['session_id']}")

            elif isinstance(message, AssistantMessage):
                print(f"  Model: {message.model}")
                for block in message.content:
                    if isinstance(block, TextBlock):
                        response_text.append(block.text)
                        preview = block.text[:200] + "..." if len(block.text) > 200 else block.text
                        print(f"  Claude: {preview}")

            elif isinstance(message, ResultMessage):
                session_id = message.session_id
                print(f"  Session ID: {session_id}")
                print(f"  Duration: {message.duration_ms}ms")
                if message.total_cost_usd:
                    print(f"  Cost: ${message.total_cost_usd:.6f}")

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return

    print()
    print("-" * 60)

    if session_id:
        SESSION_FILE.write_text(session_id)
        print(f"Session ID saved to: {SESSION_FILE}")
        print(f"Session ID: {session_id}")
        print()
        print("Next step: Run 'python spikes/spike_resume.py resume' to test session resume")
    else:
        print("ERROR: Could not capture session_id from messages")
        print("Check the message structure - session_id should be in ResultMessage")


async def resume_session():
    """Second run: resume the session and test if Claude remembers the context."""
    print("=" * 60)
    print("PHASE 2.2: Resuming Session")
    print("=" * 60)
    print()

    if not SESSION_FILE.exists():
        print(f"ERROR: No session file found at {SESSION_FILE}")
        print("Run 'python spikes/spike_resume.py' first to create a session")
        return

    session_id = SESSION_FILE.read_text().strip()
    print(f"Loaded session ID: {session_id}")
    print()

    options = ClaudeAgentOptions(
        resume=session_id,
        max_turns=1,
    )

    response_text = []
    remembered = False

    print('Sending: "What was the secret code I told you to remember?"')
    print()

    try:
        async for message in query(
            prompt="What was the secret code I told you to remember?",
            options=options
        ):
            msg_type = type(message).__name__

            if isinstance(message, AssistantMessage):
                print(f"[{msg_type}] model={message.model}")
                for block in message.content:
                    if isinstance(block, TextBlock):
                        response_text.append(block.text)
                        print(f"  Claude: {block.text}")

                        # Check if Claude remembered
                        if "ALPHA-7" in block.text.upper() or "ALPHA7" in block.text.upper():
                            remembered = True

            elif isinstance(message, ResultMessage):
                print(f"[{msg_type}]")
                print(f"  Duration: {message.duration_ms}ms")
                if message.total_cost_usd:
                    print(f"  Cost: ${message.total_cost_usd:.6f}")

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return

    print()
    print("-" * 60)
    print("SPIKE RESULTS")
    print("-" * 60)
    print()

    if remembered:
        print("Session Resume: PASSED!")
        print("Claude remembered the secret code ALPHA-7 from the previous session.")
    else:
        print("Session Resume: UNCERTAIN")
        print("Claude responded but may not have remembered the exact code.")
        print(f"Full response: {''.join(response_text)}")

    print()
    print(f"Session ID format: {session_id[:50]}..." if len(session_id) > 50 else f"Session ID format: {session_id}")
    print(f"Session ID length: {len(session_id)} characters")


async def main():
    if len(sys.argv) > 1 and sys.argv[1].lower() == "resume":
        await resume_session()
    else:
        await create_session()


if __name__ == "__main__":
    print()
    print("Starting cross-process session resume spike test...")
    print("(Make sure ANTHROPIC_API_KEY is set)")
    print()
    anyio.run(main)
