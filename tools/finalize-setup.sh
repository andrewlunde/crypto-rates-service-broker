#!/bin/bash
echo "Installing @sap/sbf package."
npm install -g @sap/sbf
echo ""

echo "Generating unique catalog ids."
cd broker
gen-catalog-ids
cd ..
echo ""

echo "Creating a hashed password for the broker service."
echo "Use the [password] you entered here in the 'cf create-service-broker' command."
hash-broker-password
echo ""

echo "Edit the manifest.yml file and replace [hashed-password] with the above sha256:.....= hashed password."
echo ""
#if [ -f '/Applications/google-cloud-sdk/completion.bash.inc' ]; then source '/Applications/google-cloud-sdk/completion.bash.inc'; fi
