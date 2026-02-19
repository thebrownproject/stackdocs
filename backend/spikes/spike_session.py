"""
Spike test: Phase 2.1 - Within-Session Memory

Purpose: Verify ClaudeSDKClient maintains context across multiple queries in same session.
Run with: cd backend && source venv/bin/activate && python spikes/spike_session.py

See: planning/agent-sdk/Migration-Tasks.md - Phase 2
"""

import anyio
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ResultMessage,
    SystemMessage,
)


async def main():
    print("=" * 60)
    print("Agent SDK Spike Test - Phase 2.1: Within-Session Memory")
    print("=" * 60)
    print()
    print("Testing if Claude remembers context across queries in same session...")
    print()

    options = ClaudeAgentOptions(
        max_turns=1,
        system_prompt="You are a helpful assistant. Be concise in your responses.",
    )

    session_id = None
    remembered_correctly = False

    try:
        async with ClaudeSDKClient(options=options) as client:
            # --- First Query: Establish context ---
            print("-" * 60)
            print("FIRST QUERY: Establishing context")
            print("-" * 60)
            print('Sending: "Remember this number: 42. It is very important."')
            print()

            await client.query("Remember this number: 42. It is very important. Just acknowledge that you have it.")

            first_response = []
            async for msg in client.receive_response():
                msg_type = type(msg).__name__

                if isinstance(msg, SystemMessage):
                    print(f"[SystemMessage] subtype={msg.subtype}")
                    if msg.data and 'session_id' in msg.data:
                        session_id = msg.data['session_id']
                        print(f"  Session ID (from init): {session_id}")

                elif isinstance(msg, AssistantMessage):
                    print(f"[AssistantMessage] model={msg.model}")
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            first_response.append(block.text)
                            preview = block.text[:200] + "..." if len(block.text) > 200 else block.text
                            print(f"  Claude: {preview}")

                elif isinstance(msg, ResultMessage):
                    print(f"[ResultMessage] session_id={msg.session_id}")
                    session_id = msg.session_id
                    print(f"  Duration: {msg.duration_ms}ms")
                    if msg.total_cost_usd:
                        print(f"  Cost: ${msg.total_cost_usd:.6f}")

            print()

            # --- Second Query: Test memory ---
            print("-" * 60)
            print("SECOND QUERY: Testing memory")
            print("-" * 60)
            print('Sending: "What number did I ask you to remember?"')
            print()

            await client.query("What number did I ask you to remember?")

            second_response = []
            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    print(f"[AssistantMessage] model={msg.model}")
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            second_response.append(block.text)
                            preview = block.text[:200] + "..." if len(block.text) > 200 else block.text
                            print(f"  Claude: {preview}")

                elif isinstance(msg, ResultMessage):
                    print(f"[ResultMessage] duration={msg.duration_ms}ms")
                    if msg.total_cost_usd:
                        print(f"  Cost: ${msg.total_cost_usd:.6f}")

            # Check if Claude remembered
            full_response = "".join(second_response)
            remembered_correctly = "42" in full_response

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    print()
    print("-" * 60)
    print("SPIKE RESULTS")
    print("-" * 60)
    print()

    if session_id:
        print(f"Session ID: {session_id}")
    else:
        print("Session ID: NOT CAPTURED")

    if remembered_correctly:
        print("Memory Test: PASSED - Claude remembered 42!")
    else:
        print("Memory Test: FAILED - Claude did not remember the number")

    print()
    print("=" * 60)


if __name__ == "__main__":
    print()
    print("Starting within-session memory spike test...")
    print("(Make sure ANTHROPIC_API_KEY is set)")
    print()
    anyio.run(main)
