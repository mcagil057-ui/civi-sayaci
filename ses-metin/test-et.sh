#!/usr/bin/env bash
# Bütün testleri çalıştırır. Model, ağ ya da ses dosyası gerektirmez.
set -u
cd "$(dirname "$0")"
python3 -m unittest discover -s testler -p "test_*.py" -v 2>&1 | tail -20
