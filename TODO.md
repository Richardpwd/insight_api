# Fix Vercel Serverless Crash

- [x] 1. Analyze project and identify crash cause
- [ ] 2. Fix `src/store/history.js` — remove `process.exit(1)` and use graceful fallback
- [ ] 3. Update `vercel.json` — replace deprecated `builds`/`routes` with modern `rewrites`
- [ ] 4. Fix `src/controllers/contract.controller.js` — lazy-load heavy dependencies (`mammoth`, `tesseract.js`, `pdf2pic`)
- [ ] 5. Verify no other startup killers remain

