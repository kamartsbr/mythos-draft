<div align="center">
  <img src="https://github.com/user-attachments/assets/c4fd48af-4ba1-4730-b0a3-57316450c520" alt="Mythos Draft Banner" width="1200">
</div>

# Mythos Draft: Age of Mythology Drafting Tool
**A high-performance, secure, and accessible drafting platform for competitive Age of Mythology players.**

[Live Demo](https://ai.studio/apps/0195b9ca-2f50-4fe1-a432-8f33bb22a396) | [AOM: Retold Community](#)
</div>

---

## 🚀 The Project
Mythos Draft is a real-time drafting tool designed for the competitive Age of Mythology scene. It allows captains to ban and pick gods and maps in a synchronized environment, providing a professional experience for tournaments and ranked practice.

## 🛠️ Technical Highlights (The "Engineering" Bit)
This project evolved from a basic prototype into a production-ready application through several architectural enhancements:

* **Database Resilience:** Implemented advanced Firestore Security Rules to ensure data integrity, preventing unauthorized modifications through owner-based validation and immutable "Finished" states.
* **Performance Optimization:** Optimized React rendering cycles using `useMemo` and `React.memo` to isolate heavy UI components (God Grids) from the real-time timer state, significantly reducing CPU overhead.
* **Robust Data Normalization:** Developed a custom timestamp abstraction layer to handle inconsistent data types from Firestore, ensuring 100% uptime for cleanup services and timers.
* **Accessibility (a11y):** Fully navigable via keyboard with ARIA labels support, making the competitive scene more inclusive.
* **Real-time Sync:** Powered by Firebase with anonymous authentication for a seamless, zero-friction user experience.

## 💻 Tech Stack
* **Frontend:** React, TypeScript, Tailwind CSS
* **Backend:** Firebase (Firestore, Auth, Hosting)
* **AI:** Gemini 3 Flash (Logic Optimization & Architecture)

## 📦 Run Locally
**Prerequisites:** Node.js (v18+)

1. Clone the repository:
   `git clone https://github.com/kamartsbr/MythosDraftv1.git`
2. Install dependencies:
   `npm install`
3. Set your environment variables in `.env.local`:
   `VITE_FIREBASE_API_KEY=your_key`
4. Start the development server:
   `npm run dev`

---
<p align="center">Developed with focus on competitive integrity and clean code.</p>