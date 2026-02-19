"""
Spike test: Phase 1.2 - Basic SDK Integration

Purpose: Verify Agent SDK works and understand message structure.
Run with: cd backend && source venv/bin/activate && python spikes/spike_agent_sdk.py

See: planning/agent-sdk/Migration-Tasks.md - Phase 1

Actual SDK Message Structure (discovered):
- AssistantMessage: content (list of blocks), model, parent_tool_use_id, error
- ResultMessage: session_id, total_cost_usd, usage, duration_ms, num_turns, result
- SystemMessage: subtype, data
- UserMessage: content, uuid, parent_tool_use_id
"""

import anyio
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ThinkingBlock,
    ResultMessage,
    SystemMessage,
    UserMessage,
)

SAMPLE_INVOICE = """
INVOICE
Invoice #: INV-2024-001
Date: January 15, 2024

From: Acme Corporation
123 Business St, Sydney NSW 2000
ABN: 12 345 678 901

To: Customer Company
456 Client Ave, Melbourne VIC 3000

Items:
- Widget A x 10 @ $50.00 = $500.00
- Widget B x 5 @ $100.00 = $500.00
- Service Fee = $200.00

Subtotal: $1,200.00
GST (10%): $120.00
Total: $1,320.00

Payment due: February 15, 2024
"""


async def main():
    print("=" * 60)
    print("Agent SDK Spike Test - Phase 1: Basic Integration")
    print("=" * 60)
    print()

    options = ClaudeAgentOptions(
        max_turns=1,
        system_prompt="You are a document analysis assistant. Analyze documents concisely.",
    )

    prompt = f"""Analyze this invoice and tell me what you see.
List the key fields you can identify (vendor, customer, amounts, dates, etc.).

Document:
{SAMPLE_INVOICE}
"""

    print("Sending query to Agent SDK...")
    print("-" * 60)
    print()

    message_count = 0
    text_chunks = []
    session_id = None

    try:
        async for message in query(prompt=prompt, options=options):
            message_count += 1
            msg_type = type(message).__name__

            if isinstance(message, AssistantMessage):
                print(f"[{message_count}] AssistantMessage")
                print(f"    Model: {message.model}")
                if message.error:
                    print(f"    Error: {message.error}")
                print(f"    Content Blocks: {len(message.content)}")

                for i, block in enumerate(message.content):
                    block_type = type(block).__name__
                    print(f"    Block {i}: {block_type}")

                    if isinstance(block, TextBlock):
                        preview = block.text[:300] + "..." if len(block.text) > 300 else block.text
                        print(f"      Text: {preview}")
                        text_chunks.append(block.text)
                    elif isinstance(block, ThinkingBlock):
                        preview = block.thinking[:200] + "..." if len(block.thinking) > 200 else block.thinking
                        print(f"      Thinking: {preview}")
                print()

            elif isinstance(message, ResultMessage):
                print(f"[{message_count}] ResultMessage (Final)")
                print(f"    Session ID: {message.session_id}")
                print(f"    Duration: {message.duration_ms}ms (API: {message.duration_api_ms}ms)")
                print(f"    Num Turns: {message.num_turns}")
                print(f"    Is Error: {message.is_error}")
                if message.total_cost_usd:
                    print(f"    Total Cost: ${message.total_cost_usd:.6f}")
                if message.usage:
                    print(f"    Usage: {message.usage}")
                session_id = message.session_id
                print()

            elif isinstance(message, SystemMessage):
                print(f"[{message_count}] SystemMessage")
                print(f"    Subtype: {message.subtype}")
                print(f"    Data: {message.data}")
                print()

            elif isinstance(message, UserMessage):
                print(f"[{message_count}] UserMessage")
                content_preview = str(message.content)[:100] + "..." if len(str(message.content)) > 100 else message.content
                print(f"    Content: {content_preview}")
                print()

            else:
                print(f"[{message_count}] {msg_type} (Unknown)")
                print(f"    Raw: {message}")
                print()

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")

    print("-" * 60)
    print("SPIKE COMPLETE")
    print("-" * 60)
    print()
    print(f"Total messages received: {message_count}")
    print(f"Total text chunks: {len(text_chunks)}")
    if session_id:
        print(f"Session ID: {session_id}")
        print("  ^ This is what we store in DB for session resume!")
    print()

    if text_chunks:
        print("FULL RESPONSE:")
        print("-" * 40)
        print("".join(text_chunks))
        print("-" * 40)


if __name__ == "__main__":
    print()
    print("Starting Agent SDK spike test...")
    print("(Make sure ANTHROPIC_API_KEY is set)")
    print()
    anyio.run(main)
