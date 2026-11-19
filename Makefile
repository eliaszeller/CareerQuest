.PHONY: backend frontend test career-data

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && pytest
	cd frontend && npm run test:unit

career-data:
	cd backend && python scripts/download_onet.py && python scripts/build_career_db.py
