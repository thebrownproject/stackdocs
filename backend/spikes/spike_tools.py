"""
Spike test: Phase 3 - Custom Tools with Multi-Turn Agent

Purpose: Test Agent SDK tool integration with realistic document extraction workflow.
- Two tools: read_document (fetch OCR) + save_extracted_data (save results)
- Multi-turn agent that thinks before extracting
- Tests both auto mode and custom mode extraction

Run with: cd backend && source venv/bin/activate && python spikes/spike_tools.py

See: planning/agent-sdk/Migration-Tasks.md - Phase 3
"""

import json
import sys
import anyio
from pathlib import Path
from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    ToolResultBlock,
    ResultMessage,
    SystemMessage,
)

# Path to sample OCR document
SAMPLE_OCR_FILE = Path(__file__).parent / "sample_ocr_output.md"

# Store extraction results for verification
extraction_results: list[dict] = []


# --- Tool Definitions ---

@tool("read_document", "Read the OCR-extracted text from a document. Call this first to get the document content.", {"document_id": str})
async def read_document(args: dict) -> dict:
    """Simulates reading OCR text from database."""
    document_id = args.get("document_id", "unknown")
    print(f"\n  [TOOL CALL] read_document(document_id={document_id})")

    if SAMPLE_OCR_FILE.exists():
        content = SAMPLE_OCR_FILE.read_text()
        print(f"  [TOOL RESULT] Returned {len(content)} characters of OCR text")
        return {
            "content": [{"type": "text", "text": content}]
        }
    else:
        return {
            "content": [{"type": "text", "text": "Error: Document not found"}],
            "isError": True
        }


@tool("save_extracted_data", "Save the extracted structured data from the document. Call this after analyzing.", {"extracted_fields": dict, "confidence_scores": dict})
async def save_extracted_data(args: dict) -> dict:
    """Captures extraction results for verification."""
    extracted_fields = args.get("extracted_fields", {})
    confidence_scores = args.get("confidence_scores", {})

    # Handle case where fields come as JSON string
    if isinstance(extracted_fields, str):
        try:
            extracted_fields = json.loads(extracted_fields)
        except json.JSONDecodeError:
            pass

    if isinstance(confidence_scores, str):
        try:
            confidence_scores = json.loads(confidence_scores)
        except json.JSONDecodeError:
            pass

    print(f"\n  [TOOL CALL] save_extracted_data")
    print(f"  [EXTRACTED FIELDS]:")
    print(json.dumps(extracted_fields, indent=4) if isinstance(extracted_fields, dict) else extracted_fields)
    print(f"  [CONFIDENCE SCORES]: {confidence_scores}")

    # Store for verification
    extraction_results.append({
        "extracted_fields": extracted_fields,
        "confidence_scores": confidence_scores
    })

    return {
        "content": [{"type": "text", "text": "Extraction saved successfully"}]
    }


# --- Test Functions ---

async def run_extraction_test(mode: str, custom_fields: list[str] | None = None):
    """Run extraction test with specified mode."""
    global extraction_results
    extraction_results = []  # Reset for each test

    print()
    print("=" * 70)
    print(f"EXTRACTION TEST: {mode.upper()} MODE")
    print("=" * 70)
    print()

    # Create MCP server with tools
    extraction_server = create_sdk_mcp_server(
        name="extraction",
        tools=[read_document, save_extracted_data]
    )

    # Build prompt based on mode
    if mode == "auto":
        prompt = """You are an expert document extraction system.

Your task:
1. First, call read_document to fetch the document content
2. Analyze the document thoroughly
3. Extract ALL relevant structured data using save_extracted_data

IMPORTANT: Use rich, nested structures. For example:
- Use "vendor" object with name, address, phone, email fields
- Use "line_items" array with objects containing description, quantity, unit_price, total
- Include confidence scores for each top-level field

Document ID to process: doc-001"""

    else:  # custom mode
        fields_str = ", ".join(custom_fields or [])
        prompt = f"""You are an expert document extraction system.

Your task:
1. First, call read_document to fetch the document content
2. Extract ONLY these specific fields: {fields_str}
3. Save the results using save_extracted_data

Only extract the requested fields. Include confidence scores for each field.

Document ID to process: doc-001"""

    options = ClaudeAgentOptions(
        mcp_servers={"extraction": extraction_server},
        allowed_tools=[
            "mcp__extraction__read_document",
            "mcp__extraction__save_extracted_data"
        ],
        max_turns=5,  # Multi-turn to allow thinking
        system_prompt="You are a document analysis agent. Always read the document first before extracting data.",
    )

    print(f"Prompt: {prompt[:200]}...")
    print()
    print("-" * 70)
    print("AGENT EXECUTION")
    print("-" * 70)

    turn_count = 0
    session_id = None
    total_cost = 0.0

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                if isinstance(message, SystemMessage):
                    print(f"\n[SystemMessage] subtype={message.subtype}")
                    if message.data and 'session_id' in message.data:
                        session_id = message.data['session_id']

                elif isinstance(message, AssistantMessage):
                    turn_count += 1
                    print(f"\n[Turn {turn_count}] AssistantMessage (model={message.model})")

                    for block in message.content:
                        if isinstance(block, TextBlock):
                            preview = block.text[:300] + "..." if len(block.text) > 300 else block.text
                            print(f"  [Thinking]: {preview}")

                        elif isinstance(block, ThinkingBlock):
                            preview = block.thinking[:200] + "..." if len(block.thinking) > 200 else block.thinking
                            print(f"  [Extended Thinking]: {preview}")

                        elif isinstance(block, ToolUseBlock):
                            print(f"  [Tool Use]: {block.name}")
                            if block.name == "mcp__extraction__save_extracted_data":
                                # Already logged in tool function
                                pass
                            else:
                                print(f"    Input: {json.dumps(block.input)}")

                        elif isinstance(block, ToolResultBlock):
                            preview = str(block.content)[:100] + "..." if len(str(block.content)) > 100 else str(block.content)
                            print(f"  [Tool Result]: {preview}")

                elif isinstance(message, ResultMessage):
                    session_id = message.session_id
                    if message.total_cost_usd:
                        total_cost = message.total_cost_usd
                    print(f"\n[ResultMessage]")
                    print(f"  Session ID: {session_id}")
                    print(f"  Duration: {message.duration_ms}ms")
                    print(f"  Turns: {message.num_turns}")
                    if message.total_cost_usd:
                        print(f"  Cost: ${message.total_cost_usd:.6f}")

    except Exception as e:
        print(f"\nERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None

    print()
    print("-" * 70)
    print("TEST RESULTS")
    print("-" * 70)
    print()

    if extraction_results:
        result = extraction_results[-1]  # Last extraction
        print(f"Mode: {mode}")
        print(f"Turns used: {turn_count}")
        print(f"Session ID: {session_id}")
        print(f"Total cost: ${total_cost:.6f}")
        print()

        # Analyze extracted fields
        fields = result["extracted_fields"]
        scores = result["confidence_scores"]

        print("Extracted Fields:")
        for key, value in fields.items():
            is_nested = isinstance(value, (dict, list))
            score = scores.get(key, "N/A")
            print(f"  - {key}: {'[nested]' if is_nested else value} (confidence: {score})")

        # Check for nested structures (quality indicator)
        nested_count = sum(1 for v in fields.values() if isinstance(v, (dict, list)))
        print()
        print(f"Nested structures: {nested_count}/{len(fields)}")

        if mode == "auto" and nested_count >= 3:
            print("Quality: GOOD - Has rich nested structures")
        elif mode == "custom" and len(fields) == len(custom_fields or []):
            print("Quality: GOOD - Extracted only requested fields")
        else:
            print("Quality: CHECK - Review output structure")

        return result
    else:
        print("ERROR: No extraction results captured")
        return None


async def main():
    print()
    print("=" * 70)
    print("Agent SDK Spike Test - Phase 3: Custom Tools")
    print("=" * 70)
    print()
    print("Testing multi-turn agent with read_document + save_extracted_data tools")
    print()

    # Check sample document exists
    if not SAMPLE_OCR_FILE.exists():
        print(f"ERROR: Sample OCR file not found at {SAMPLE_OCR_FILE}")
        print("Create sample_ocr_output.md first")
        return

    # Determine which test to run
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
        if mode == "custom":
            custom_fields = ["invoice_number", "total_amount", "vendor_name", "due_date"]
            await run_extraction_test("custom", custom_fields)
        elif mode == "auto":
            await run_extraction_test("auto")
        else:
            print(f"Unknown mode: {mode}")
            print("Usage: python spike_tools.py [auto|custom]")
    else:
        # Run both tests
        print("Running both Auto and Custom mode tests...")
        print()

        # Auto mode test
        auto_result = await run_extraction_test("auto")

        print()
        print()

        # Custom mode test
        custom_result = await run_extraction_test(
            "custom",
            ["invoice_number", "total_amount", "vendor_name", "due_date"]
        )

        # Summary
        print()
        print("=" * 70)
        print("SPIKE SUMMARY")
        print("=" * 70)
        print()
        print("Auto Mode:", "PASSED" if auto_result else "FAILED")
        print("Custom Mode:", "PASSED" if custom_result else "FAILED")
        print()

        if auto_result:
            auto_nested = sum(1 for v in auto_result["extracted_fields"].values()
                           if isinstance(v, (dict, list)))
            print(f"Auto mode nested structures: {auto_nested}")

        if custom_result:
            custom_fields_count = len(custom_result["extracted_fields"])
            print(f"Custom mode fields extracted: {custom_fields_count}")


if __name__ == "__main__":
    print()
    print("Starting Phase 3 tool spike test...")
    print("(Make sure ANTHROPIC_API_KEY is set)")
    print()
    anyio.run(main)
