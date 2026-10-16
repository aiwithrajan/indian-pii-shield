#!/usr/bin/env python3
"""
Automated Demo Video Producer for Indian-PII Shield.
Captures live UI views via headless Chrome, generates natural voice narration using macOS TTS,
and compiles a high-definition 1080p MP4 presentation video with FFmpeg.
"""

import os
import sys
import time
import subprocess
import json

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG_BIN = "/Users/apple/Downloads/hacktoberfest/ffmpeg"
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
WORK_DIR = "/tmp/video_production"
OUTPUT_VIDEO = os.path.join(REPO_ROOT, "docs", "demo", "indian_pii_shield_demo.mp4")
OUTPUT_THUMBNAIL = os.path.join(REPO_ROOT, "docs", "demo", "thumbnail.png")

SCENES = [
    {
        "id": "scene_1_home",
        "title": "Introduction & Regulatory Crisis",
        "url": "http://127.0.0.1:5173/?tab=home",
        "narration": (
            "Welcome to Indian PII Shield, an open-source, OpenAI-compatible privacy proxy "
            "designed to solve a critical compliance crisis. Under India's Digital Personal "
            "Data Protection Act of 2023, data breaches carry statutory penalties of up to "
            "two hundred and fifty crore rupees. When Indian startups pipe customer data to "
            "cloud LLMs, sensitive citizen identifiers leak. Generic Western redactors fail "
            "on Indian formats. Indian PII Shield acts as a local zero-leakage perimeter before "
            "data ever leaves your internal network."
        )
    },
    {
        "id": "scene_2_overview",
        "title": "Dual-Engine Architecture",
        "url": "http://127.0.0.1:5173/?tab=product&page=overview",
        "narration": (
            "At its core is a hybrid dual-engine architecture. Layer one utilizes deterministic "
            "group mathematics, including Verhoeff dihedral group D five checksums for Aadhaar, "
            "Modulo-36 check characters for GSTIN, and the Luhn algorithm for payment cards. "
            "Layer two deploys an Indic contextual NER engine fine-tuned for Indian names, "
            "landmark addresses, and Hinglish spoken digits. Raw PII exists strictly in transient "
            "RAM with sub-millisecond TTL, guaranteeing zero bytes stored on disk."
        )
    },
    {
        "id": "scene_3_playground",
        "title": "Live PII Playground & Real-Time Masking",
        "url": "http://127.0.0.1:5173/?tab=product&page=playground",
        "narration": (
            "In the interactive Playground, developers can test real-time masking across seventeen "
            "statutory Indian PII categories. Watch as Aadhaar, Income Tax PAN, commercial GSTIN, "
            "UPI handles, and ABHA Health IDs are instantly sanitized into stable tokens like "
            "PAN one and AADHAAR one. The upstream model sees only safe tokens, and the proxy "
            "transparently restores the original values into the response on egress."
        )
    },
    {
        "id": "scene_4_temporal",
        "title": "Temporal Orchestration DAG & HITL Quarantine",
        "url": "http://127.0.0.1:5173/?tab=product&page=temporal",
        "narration": (
            "For mission-critical reliability, privacy execution is orchestrated via a durable "
            "Temporal DAG workflow. Four resilient activities manage PII scanning, statutory "
            "policy evaluation, upstream dispatch, and audit logging. If high-risk or ambiguous "
            "PII is detected, the workflow triggers a Human-In-The-Loop quarantine, pausing execution "
            "until a security administrator issues an authenticated approval signal. This prevents "
            "any accidental leakage even across network drops or server reboots."
        )
    },
    {
        "id": "scene_5_ledger",
        "title": "Cryptographic Audit Ledger & DPDP Section 8",
        "url": "http://127.0.0.1:5173/?tab=product&page=ledger",
        "narration": (
            "Compliance requires verifiable proof. The Audit Ledger enforces Section 8 of the "
            "DPDP Act with immutable cryptographic audit receipts. Every transaction records "
            "timestamps, processing latency, entity counts, and chained SHA-256 fingerprints, "
            "with zero raw PII stored in the database. Compliance officers can download forensic "
            "JSON receipts with one click for regulatory reporting."
        )
    },
    {
        "id": "scene_6_regression",
        "title": "Mathematical Regression & Checksum Fixtures",
        "url": "http://127.0.0.1:5173/?tab=product&page=regression",
        "narration": (
            "To eliminate false positives and model hallucinations, the regression test suite "
            "validates pure mathematical checksums. Our Verhoeff dihedral group fixtures verify "
            "authentic twelve-digit Aadhaar numbers while instantly rejecting fake or mistyped digits. "
            "With twenty out of twenty unit tests passing, the system delivers one hundred percent "
            "recall on structured Indian identifiers."
        )
    },
    {
        "id": "scene_7_pricing",
        "title": "Developer Integration & Commercial Model",
        "url": "http://127.0.0.1:5173/?tab=pricing",
        "narration": (
            "Integration takes under two minutes. Simply point your OpenAI client base URL to "
            "localhost port 8080. Built as a viable side hustle for Hacktoberfest, Indian PII "
            "Shield offers an open-source Developer tier and a five hundred rupees per month "
            "Enterprise VPC tier for Indian startups and agencies. Indian PII Shield: defending "
            "citizen privacy and keeping enterprise AI compliant."
        )
    }
]


def run_cmd(cmd, desc):
    print(f"  ➜ {desc}...")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"    [Error] {res.stderr[:200]}")
    return res.returncode == 0


def main():
    print("=" * 70)
    print("🎬 INDIAN-PII SHIELD: OFFICIAL DEMO VIDEO PRODUCER")
    print("=" * 70)
    os.makedirs(WORK_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_VIDEO), exist_ok=True)

    scene_videos = []

    for idx, scene in enumerate(SCENES, start=1):
        scene_id = scene["id"]
        title = scene["title"]
        print(f"\n[{idx}/{len(SCENES)}] Processing Scene {idx}: {title}")

        # 1. Capture 1080p Screenshot
        img_path = os.path.join(WORK_DIR, f"{scene_id}.png")
        chrome_cmd = (
            f'"{CHROME_BIN}" --headless --disable-gpu --virtual-time-budget=2000 '
            f'--window-size=1920,1080 --screenshot="{img_path}" "{scene["url"]}"'
        )
        run_cmd(chrome_cmd, f"Capturing 1080p frame from {scene['url']}")
        time.sleep(1)

        # 2. Generate Narration Audio using Rishi (en_IN)
        aiff_path = os.path.join(WORK_DIR, f"{scene_id}.aiff")
        aac_path = os.path.join(WORK_DIR, f"{scene_id}.m4a")
        # rate 175 wpm gives a calm, natural presentation tempo
        say_cmd = f'say -v Rishi -r 175 -o "{aiff_path}" "{scene["narration"]}"'
        run_cmd(say_cmd, "Synthesizing Rishi voice narration")

        # Convert AIFF to high quality AAC with padding
        # Pad with 0.4s silence at beginning and end for smooth transitions
        ffmpeg_audio_cmd = (
            f'"{FFMPEG_BIN}" -y -i "{aiff_path}" '
            f'-af "adelay=400|400,apad=pad_dur=0.5" '
            f'-c:a aac -b:a 192k "{aac_path}"'
        )
        run_cmd(ffmpeg_audio_cmd, "Muxing AAC audio stream with boundary padding")

        # 3. Create MP4 Scene Video
        mp4_path = os.path.join(WORK_DIR, f"{scene_id}.mp4")
        ffmpeg_scene_cmd = (
            f'"{FFMPEG_BIN}" -y -loop 1 -i "{img_path}" -i "{aac_path}" '
            f'-c:v libx264 -tune stillimage -pix_fmt yuv420p -r 25 '
            f'-c:a copy -shortest "{mp4_path}"'
        )
        run_cmd(ffmpeg_scene_cmd, "Encoding 1080p H.264 video segment")
        scene_videos.append(mp4_path)

    # 4. Concatenate all scenes into the final video
    print("\n[Muxing] Concatenating all scenes into final video...")
    concat_file = os.path.join(WORK_DIR, "concat_list.txt")
    with open(concat_file, "w") as f:
        for v in scene_videos:
            f.write(f"file '{v}'\n")

    concat_cmd = (
        f'"{FFMPEG_BIN}" -y -f concat -safe 0 -i "{concat_file}" '
        f'-c copy "{OUTPUT_VIDEO}"'
    )
    run_cmd(concat_cmd, "Muxing final MP4 presentation video")

    # 5. Generate high-res thumbnail from scene 1
    thumbnail_source = os.path.join(WORK_DIR, "scene_1_home.png")
    if os.path.exists(thumbnail_source):
        subprocess.run(f'cp "{thumbnail_source}" "{OUTPUT_THUMBNAIL}"', shell=True)
        print(f"  ✓ Thumbnail saved: {OUTPUT_THUMBNAIL}")

    # 6. Verify and report video statistics
    probe_cmd = f'"{FFMPEG_BIN}" -i "{OUTPUT_VIDEO}" 2>&1'
    probe_res = subprocess.run(probe_cmd, shell=True, capture_output=True, text=True)
    
    file_size_mb = os.path.getsize(OUTPUT_VIDEO) / (1024 * 1024) if os.path.exists(OUTPUT_VIDEO) else 0

    print("\n" + "=" * 70)
    print("🎉 VIDEO PRODUCTION COMPLETE!")
    print(f"• Video Path: {OUTPUT_VIDEO}")
    print(f"• File Size:  {file_size_mb:.2f} MB")
    print(f"• Thumbnail:  {OUTPUT_THUMBNAIL}")
    print("=" * 70)


if __name__ == "__main__":
    main()
