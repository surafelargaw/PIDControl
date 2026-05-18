"use client";

import { useState } from "react";
import { getStoredRole, setStoredRole } from "@/lib/platform/local-store";

export function ProfileSettings() {
  const [role, setRole] = useState(getStoredRole());

  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Profile</p>
        <h2>Role And Platform Status</h2>
        <p>
          PID Trainer is ready for trainee, instructor, and admin roles. Today the experience runs in local-only mode,
          so your work stays on this device unless a cloud backend is added later.
        </p>
      </section>

      <section className="two-up">
        <article className="panel">
          <p className="eyebrow">Role</p>
          <h2>Training Persona</h2>
          <div className="field">
            <span className="label">Current Role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setStoredRole(event.target.value);
              }}
            >
              <option value="trainee">Trainee</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Storage</p>
          <h2>Local Data Persistence</h2>
          <div className="annotation-list">
            <div className="annotation">
              <h3>Status</h3>
              <p>All data is stored locally in your browser for return visits and practice history.</p>
            </div>
            <div className="annotation">
              <h3>Features</h3>
              <p>Saved runs, scenario attempts, and role settings stay on this device across sessions.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
