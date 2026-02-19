"""
Test: System Prompt is Applied to ClaudeAgentOptions

Verifies that the `system_prompt` parameter in ClaudeAgentOptions
is actually being read and applied by the Claude Agent SDK.

How it works:
    1. Defines secret facts ONLY in the system prompt
    2. Asks the agent about those facts (without hinting at answers)
    3. If agent knows the facts → system prompt is working

Run:
    cd backend
    source venv/bin/activate
    python -m pytest tests/agents/test_system_prompt.py -v

    # Or standalone:
    python tests/agents/test_system_prompt.py
"""

import asyncio

try:
    import pytest
    PYTEST_AVAILABLE = True
except ImportError:
    PYTEST_AVAILABLE = False

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
)

# Secret facts the agent can ONLY know from the system prompt
SYSTEM_PROMPT = """You are a helpful assistant.

Remember these facts:
- The secret code is: MANGO-7749
- The project name is: Operation Starfish
- The launch date is: March 15th
"""


async def run_system_prompt_test() -> tuple[str, bool]:
    """
    Run agent with system prompt containing secret facts,
    then ask about them.

    Returns:
        (response_text, passed)
    """
    options = ClaudeAgentOptions(
        system_prompt=SYSTEM_PROMPT,
        max_turns=1,
    )

    collected_text = []

    async with ClaudeSDKClient(options=options) as client:
        # Ask about facts - answers are NOT in this query
        await client.query("What is the secret code, project name, and launch date?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        collected_text.append(block.text)

    response = " ".join(collected_text)

    # Agent should know these from system prompt
    passed = "MANGO-7749" in response and "Starfish" in response

    return response, passed


if PYTEST_AVAILABLE:
    @pytest.mark.asyncio
    async def test_system_prompt_is_applied():
        """System prompt should provide facts the agent can recall."""
        response, passed = await run_system_prompt_test()
        assert "MANGO-7749" in response, "Agent should know secret code from system prompt"
        assert "Starfish" in response, "Agent should know project name from system prompt"


# Allow running standalone
if __name__ == "__main__":
    response, passed = asyncio.run(run_system_prompt_test())
    print(f"\nRESPONSE:\n{response}\n")
    print("PASS: System prompt IS being read!" if passed else "FAIL: System prompt NOT read")
    exit(0 if passed else 1)
