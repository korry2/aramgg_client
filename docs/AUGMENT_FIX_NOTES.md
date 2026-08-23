# Augment recommendation diagnosis

The current augment OCR pipeline can stop before PaddleOCR when fewer than two reroll-button regions pass a pixel heuristic. This is independent of whether the three card title regions contain readable augment names. The next fix should treat strong title activity as sufficient to attempt OCR, while retaining reroll-button diagnostics for telemetry.
