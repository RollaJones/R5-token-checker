#!/usr/bin/env python3
import sys
import json
from rugcheck import rugcheck

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No token address provided"}))
        sys.exit(1)
    token = sys.argv[1]
    try:
        rc = rugcheck(token)
        # Output the full RugCheck response as a dictionary
        print(json.dumps(rc.to_dict()))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
