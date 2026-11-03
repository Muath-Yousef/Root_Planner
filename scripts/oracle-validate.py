#!/usr/bin/env python3
"""
scripts/oracle-validate.py
Independent Python Oracle Validator for socroot-topology-studio exports.
Shares ZERO code with Ajv or JavaScript runtime.

Validates:
1. Schema conformance of exported JSON files using Python jsonschema.
2. Syntax correctness of generated Python files using python's built-in py_compile.
3. Verification of the embedded PEP block (SCA-002) in generated code.
"""

import sys
import os
import json
import glob
import py_compile
import jsonschema

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCHEMAS_DIR = os.path.join(REPO_ROOT, "src", "schemas")

def load_schemas():
    schemas = {}
    for f in glob.glob(os.path.join(SCHEMAS_DIR, "*.schema.json")):
        name = os.path.basename(f).replace(".schema.json", "")
        with open(f, "r", encoding="utf-8") as fp:
            schemas[name] = json.load(fp)
    return schemas

def validate_exported_bundle(bundle_dir):
    print(f"🔍 Validating exported bundle at: {bundle_dir}")
    schemas = load_schemas()
    errors = 0
    checked_files = 0

    # 1. Validate contract.json files against contract schema
    for contract_path in glob.glob(os.path.join(bundle_dir, "**", "contract.json"), recursive=True):
        checked_files += 1
        with open(contract_path, "r", encoding="utf-8") as fp:
            try:
                data = json.load(fp)
                if "contract" in schemas:
                    jsonschema.validate(instance=data, schema=schemas["contract"])
                    print(f"  ✅ [Schema] Valid contract: {os.path.relpath(contract_path, bundle_dir)}")
            except Exception as e:
                print(f"  ❌ [Schema Error] in {contract_path}: {e}")
                errors += 1

    # 2. Syntax check Python files using py_compile
    for py_path in glob.glob(os.path.join(bundle_dir, "**", "*.py"), recursive=True):
        checked_files += 1
        try:
            py_compile.compile(py_path, doraise=True)
            print(f"  ✅ [Python Compile] Syntax valid: {os.path.relpath(py_path, bundle_dir)}")
        except py_compile.PyCompileError as e:
            print(f"  ❌ [Python Syntax Error] in {py_path}: {e}")
            errors += 1

        # 3. Check PEP block presence in employee.py
        if os.path.basename(py_path) == "employee.py":
            with open(py_path, "r", encoding="utf-8") as fp:
                code = fp.read()
                if "EMBEDDED PEP BEGIN (SCA-002)" in code and "EMBEDDED PEP END" in code:
                    print(f"  ✅ [PEP Guardrail] Embedded PEP block present in {os.path.relpath(py_path, bundle_dir)}")
                else:
                    print(f"  ❌ [PEP Missing] Missing mandatory embedded PEP guardrail in {py_path}")
                    errors += 1

    print("\n-------------------------------------------------------")
    print(f"Total files checked by Python Oracle: {checked_files}")
    if errors == 0:
        print("🎉 ALL INDEPENDENT PYTHON ORACLE CHECKS PASSED (0 errors)")
        return 0
    else:
        print(f"💥 ORACLE VALIDATION FAILED WITH {errors} ERROR(S)")
        return 1

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO_ROOT, "dist")
    sys.exit(validate_exported_bundle(target))
