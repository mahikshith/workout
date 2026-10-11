#!/usr/bin/env bash
# Runs a command; on failure, surfaces the log tail as one annotation (logs need sign-in, annotations don't).
log=$(mktemp)
"$@" >"$log" 2>&1
code=$?
cat "$log"
if [ $code -ne 0 ]; then
  echo "::error title=$1 failed::$(tail -n 60 "$log" | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')"
fi
exit $code
