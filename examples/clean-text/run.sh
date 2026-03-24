#!/bin/bash
cat companies.jsonl | atq -p "Normalize this company name. Return just the name." -c 10
