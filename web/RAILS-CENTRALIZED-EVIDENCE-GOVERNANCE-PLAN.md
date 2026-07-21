# RAILS Centralized Evidence Governance Plan

## Objective
Make RAILS evidence a governed, centralized library for each loop. Evidence is uploaded once, retained as the source record, and linked or unlinked to the action, verification, standardization, or closure records that need proof.

## Enterprise Rules
- Evidence deletion is separate from action deletion. Deleting an action step unlinks its evidence references but keeps the uploaded evidence record available in the Evidence Library.
- Evidence linking and unlinking are auditable events. The audit log must show the action, evidence label, previous link state, new link state, timestamp, and actor.
- Unlinking evidence requires explicit confirmation so users cannot accidentally remove proof from a governed action step.
- Evidence uploads store metadata: uploader, upload timestamp, file type, file size, label, status, purpose, and visibility.
- Evidence visibility defaults to public within the loop. Private evidence can only be used when the RAILS loop owner matches the uploader.
- Evidence upload happens in one centralized Evidence Library panel section, opened directly from a Loop Detail header icon. It is not part of the guided workflow pagination.
- Photos support thumbnail preview and full view. Images can be edited by cropping and marking the uploaded photo, then saved back as a governed evidence update.
- Documents open through authenticated backend routes.
- The RAILS AI assistant must understand this evidence model and guide users to upload once, link deliberately, and avoid deleting proof when deleting action steps.

## Implementation Steps
1. Extend the RAILS evidence contract with `fileSizeBytes` and `visibility`.
2. Update backend upload/update behavior so metadata is preserved when renaming or changing visibility without replacing the file.
3. Change action deletion to unlink evidence only, keeping centralized evidence records and files intact.
4. Add backend audit summaries for evidence link and unlink changes on action records.
5. Add frontend unlink confirmation near the evidence checkbox area before removing a link.
6. Add a Loop Detail header Evidence Library icon that opens the centralized evidence panel section outside guided pagination.
7. Add metadata hint popovers with uploader profile, date, time, file type, file size, availability note, and visibility switch.
8. Add evidence rename and image edit controls in the Evidence Library.
9. Update RAILS AI knowledge with the centralized evidence governance rules.
10. Verify frontend and backend with typecheck and production build.
