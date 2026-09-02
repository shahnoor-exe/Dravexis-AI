import os
import sys

def verify_advanced_ux():
    print("Running Final Statutory QA Gate: Advanced Agentic UX Matrix...")
    
    components_dir = os.path.join("ui", "mrpl-workbench", "src", "components")
    
    required_features = {
        "Phase 9.1 Launch Standard": "TopBar.tsx",
        "Phase 9.2 Node Drill-down": "NodeDrilldownDrawer.tsx",
        "Phase 9.3 HITL Safety Gates": "CenterStage.tsx",
        "Phase 9.4 Artifact Split-screen Preview": "PreviewPane.tsx",
        "Phase 9.5 Resizable Modular Panels": "../hooks/useResizer.ts",
        "Phase 9.6 Branching History": "HistoryWorkspace.tsx",
        "Phase 9.7 Run-level Telemetry": "CenterStage.tsx",
        "Phase 9.8 Media Tray and Pinned Context": "MediaTray.tsx",
        "Phase 9.9 Global Memory Manager": "HistoryWorkspace.tsx",
        "Phase 9.10 API Payload Inspector": "ApiInspectorModal.tsx"
    }

    all_passed = True
    for feature, file_path in required_features.items():
        full_path = os.path.join(components_dir, file_path)
        if os.path.exists(full_path):
            print(f"[PASS] {feature}: Found in {file_path}")
        else:
            print(f"[FAIL] {feature}: Missing {file_path}")
            all_passed = False

    if all_passed:
        print("\nAll advanced agentic UX features successfully verified.")
        sys.exit(0)
    else:
        print("\nVerification failed. Missing required components.")
        sys.exit(1)

if __name__ == "__main__":
    verify_advanced_ux()
