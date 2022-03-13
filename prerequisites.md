# Prerequisites for running the @sap/sbf examples

## Create Audit log service
As a prerequisite, an Audit log service instance have to be created and bound to the broker application

```bash
cf create-service auditlog standard crypto-rates-audit
```

## Credentials
- Replace all occurrences of `broker` in the corresponding files of the specific example with the user name
to be used when registering the service broker.
- Use the `hash-broker-passsword` script which can generate a string in the hashed password format
used by _@sap/sbf_. It can either generate it using a password provided by the user or
using a randomly generated one (when the script is run in batch mode with the `-b` argument).
The plain text password (custom or auto generated) is used when registering the broker.
The hashed password string is used in the `SBF_BROKER_CREDENTIALS_HASH` environment variable in the samples
(replace all occurrences of `[hashed-password]` with it in the corresponding files of the specific example).
More information on hashed credentials can be found [here](/README.md#service-broker-hashed-credentials).
