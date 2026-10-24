import sys
import os
import re
import json
import pymupdf

def find_question_boxes(doc):
    """
    Finds bounding boxes and page numbers for each Q.1 to Q.65 in the document.
    """
    questions = {}
    for page_num in range(len(doc)):
        page = doc[page_num]
        # Search for Q.1 to Q.65
        for q_num in range(1, 66):
            patterns = [f"Q.{q_num} ", f"Q.{q_num}\n", f"Q. {q_num} ", f"Q. {q_num}\n", f"Q.{q_num}.", f"Q.{q_num}"]
            rects = []
            for pat in patterns:
                found = page.search_for(pat)
                if found:
                    rects.extend(found)
                    break
            if rects:
                # Filter out references in explanations/text (only consider leftmost/header occurrences)
                header_rect = None
                for r in rects:
                    if r.x0 < 200: # headers are on the left
                        header_rect = r
                        break
                if header_rect:
                    questions[q_num] = {
                        "page": page_num,
                        "header_rect": header_rect
                    }
    return questions

def extract_figures_for_doc(pdf_path, paper_prefix, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    q_boxes = find_question_boxes(doc)
    extracted = {}

    sorted_q_nums = sorted(q_boxes.keys())
    for idx, q_num in enumerate(sorted_q_nums):
        q_info = q_boxes[q_num]
        page_num = q_info["page"]
        page = doc[page_num]
        y_top = q_info["header_rect"].y0

        # y_bottom is either the next question on the same page, or the bottom margin
        y_bottom = page.rect.height - 40
        if idx + 1 < len(sorted_q_nums):
            next_q = q_boxes[sorted_q_nums[idx + 1]]
            if next_q["page"] == page_num:
                y_bottom = next_q["header_rect"].y0 - 5

        # Check for embedded raster images
        img_list = page.get_images()
        found_imgs = []
        for img in img_list:
            xref = img[0]
            for r in page.get_image_rects(xref):
                # Ignore header/footer logos (top < 70 or bottom > height - 40)
                if r.y0 < 70 or r.y1 > page.rect.height - 35:
                    continue
                # Check if image overlaps with question vertical bounds
                if (r.y0 >= y_top - 10 and r.y0 <= y_bottom) or (r.y1 >= y_top and r.y1 <= y_bottom + 10):
                    found_imgs.append((xref, r))

        q_id = f"{paper_prefix}-q{str(q_num).zfill(2)}"

        if found_imgs:
            # Combine bounding boxes of all images found for this question
            min_x0 = min(r.x0 for _, r in found_imgs)
            min_y0 = min(r.y0 for _, r in found_imgs)
            max_x1 = max(r.x1 for _, r in found_imgs)
            max_y1 = max(r.y1 for _, r in found_imgs)

            # Add a small padding
            clip_rect = pymupdf.Rect(
                max(0, min_x0 - 5),
                max(0, min_y0 - 5),
                min(page.rect.width, max_x1 + 5),
                min(page.rect.height, max_y1 + 5)
            )

            out_filename = f"{q_id}.png"
            out_filepath = os.path.join(output_dir, out_filename)
            pix = page.get_pixmap(clip=clip_rect, dpi=200)
            pix.save(out_filepath)
            extracted[q_id] = f"/figures/{out_filename}"
        else:
            # Check for vector drawings (circuits/graphs drawn via paths)
            drawings = page.get_drawings()
            q_drawings = []
            for d in drawings:
                dr = d["rect"]
                if dr.y0 < 70 or dr.y1 > page.rect.height - 35:
                    continue
                # Exclude trivial horizontal separator lines
                if dr.height < 2 and dr.width > 300:
                    continue
                if (dr.y0 >= y_top and dr.y0 <= y_bottom) or (dr.y1 >= y_top and dr.y1 <= y_bottom):
                    q_drawings.append(dr)
            
            # If significant drawings found (not just single dots/lines)
            if len(q_drawings) >= 3:
                min_x0 = min(dr.x0 for dr in q_drawings)
                min_y0 = min(dr.y0 for dr in q_drawings)
                max_x1 = max(dr.x1 for dr in q_drawings)
                max_y1 = max(dr.y1 for dr in q_drawings)

                if (max_x1 - min_x0) > 40 and (max_y1 - min_y0) > 30:
                    clip_rect = pymupdf.Rect(
                        max(0, min_x0 - 8),
                        max(0, min_y0 - 8),
                        min(page.rect.width, max_x1 + 8),
                        min(page.rect.height, max_y1 + 8)
                    )
                    out_filename = f"{q_id}.png"
                    out_filepath = os.path.join(output_dir, out_filename)
                    pix = page.get_pixmap(clip=clip_rect, dpi=200)
                    pix.save(out_filepath)
                    extracted[q_id] = f"/figures/{out_filename}"

    return extracted

if __name__ == "__main__":
    test_pdf = "backend/data/gate_downloads/gate-2024-cs-paper.pdf"
    res = extract_figures_for_doc(test_pdf, "gate-2024-cs", "backend/public/figures")
    print(f"Extracted {len(res)} figures for 2024 CS1:")
    for k, v in res.items():
        print(f"  {k} -> {v}")
