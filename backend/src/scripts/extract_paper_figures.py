import sys
import os
import json
import pymupdf

def extract_figures_for_paper(pdf_path, source_id, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)

    # Determine paper prefix and session code for ID generation
    # e.g., gate-2024-cs-paper -> gate-2024-cs
    # e.g., gate-2024-cs2-paper -> gate-2024-cs2
    # e.g., gate-2025-cs1-paper -> gate-2025-cs1
    parts = source_id.replace("-paper", "")
    
    # 1. Map all question start positions (Q.1 to Q.65)
    # Store: q_num -> { "page": page_idx, "header_rect": Rect, "opts_rect": Rect }
    questions = {}
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        for q_num in range(1, 66):
            if q_num in questions:
                continue
            for pat in [f"Q.{q_num} ", f"Q.{q_num}\n", f"Q. {q_num} ", f"Q. {q_num}\n", f"Q.{q_num}.", f"Q.{q_num}"]:
                rects = page.search_for(pat)
                valid = [r for r in rects if r.x0 < 220] # Left side headers
                if valid:
                    questions[q_num] = {
                        "page": p_idx,
                        "header_rect": valid[0],
                    }
                    break

    # Also search for option (A) positions for each question
    for q_num, q_info in questions.items():
        page = doc[q_info["page"]]
        y_start = q_info["header_rect"].y0
        opt_rects = page.search_for("(A)")
        opt_below = [r for r in opt_rects if r.y0 > y_start and r.x0 < 250]
        if opt_below:
            q_info["opt_rect"] = opt_below[0]
        else:
            q_info["opt_rect"] = None

    results = {}
    sorted_q_nums = sorted(questions.keys())

    for idx, q_num in enumerate(sorted_q_nums):
        q_info = questions[q_num]
        p_idx = q_info["page"]
        page = doc[p_idx]
        y_start = q_info["header_rect"].y0

        # Bottom bound: option (A), or next question, or bottom margin
        if q_info["opt_rect"]:
            y_end = q_info["opt_rect"].y0
        elif idx + 1 < len(sorted_q_nums) and questions[sorted_q_nums[idx + 1]]["page"] == p_idx:
            y_end = questions[sorted_q_nums[idx + 1]]["header_rect"].y0 - 5
        else:
            y_end = page.rect.height - 40

        # Look for images located vertically between y_start and y_end
        img_list = page.get_images()
        matched_imgs = []
        for img in img_list:
            xref = img[0]
            for r in page.get_image_rects(xref):
                # Ignore top logo or footer
                if r.y0 < 65 or r.y1 > page.rect.height - 35:
                    continue
                # Center of image must fall within question bounds
                center_y = (r.y0 + r.y1) / 2
                if y_start <= center_y <= y_end + 20:
                    matched_imgs.append(r)

        clip_rect = None
        if matched_imgs:
            # Combine image rects
            min_x0 = max(10, min(r.x0 for r in matched_imgs) - 4)
            min_y0 = max(y_start, min(r.y0 for r in matched_imgs) - 4)
            max_x1 = min(page.rect.width - 10, max(r.x1 for r in matched_imgs) + 4)
            max_y1 = min(page.rect.height - 30, max(r.y1 for r in matched_imgs) + 4)
            clip_rect = pymupdf.Rect(min_x0, min_y0, max_x1, max_y1)
        else:
            # Check for vector drawings (circuits/graphs without raster XObjects)
            drawings = page.get_drawings()
            d_rects = []
            for d in drawings:
                dr = d["rect"]
                if dr.y0 < 65 or dr.y1 > page.rect.height - 35:
                    continue
                if dr.height < 3 and dr.width > 200:
                    continue # Divider lines
                center_y = (dr.y0 + dr.y1) / 2
                if y_start + 15 <= center_y <= y_end:
                    d_rects.append(dr)

            if len(d_rects) >= 4:
                min_x0 = max(10, min(r.x0 for r in d_rects) - 5)
                min_y0 = max(y_start + 15, min(r.y0 for r in d_rects) - 5)
                max_x1 = min(page.rect.width - 10, max(r.x1 for r in d_rects) + 5)
                max_y1 = min(page.rect.height - 30, max(r.y1 for r in d_rects) + 5)
                # Ensure it has meaningful size
                if (max_x1 - min_x0) > 40 and (max_y1 - min_y0) > 30:
                    clip_rect = pymupdf.Rect(min_x0, min_y0, max_x1, max_y1)

        if clip_rect and clip_rect.width > 30 and clip_rect.height > 20:
            q_id = f"{parts}-q{str(q_num).zfill(2)}"
            filename = f"{q_id}.png"
            filepath = os.path.join(output_dir, filename)
            pix = page.get_pixmap(clip=clip_rect, dpi=200)
            pix.save(filepath)
            results[q_num] = f"/figures/{filename}"

    return results

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({}))
        sys.exit(0)
    pdf_path = sys.argv[1]
    source_id = sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "backend/public/figures"
    res = extract_figures_for_paper(pdf_path, source_id, out_dir)
    print(json.dumps(res))
