"""List available Anthropic models using API key from .env"""

import os
import sys
from pathlib import Path

# Add parent directory to path to access config
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from anthropic import Anthropic

# Load .env from backend directory
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

api_key = os.getenv("ANTHROPIC_API_KEY")

if not api_key:
    print("Error: ANTHROPIC_API_KEY not found in .env")
    print(f"Looked in: {env_path}")
    sys.exit(1)

client = Anthropic(api_key=api_key)

print("Available Anthropic Models:")
print("-" * 50)

# List all models
page = client.models.list()

for model in page.data:
    print(f"  {model.id}")
    if hasattr(model, 'display_name') and model.display_name:
        print(f"    Display: {model.display_name}")
    print()

print("-" * 50)
print(f"Total: {len(page.data)} models")
