// =====================================================================
// High-level actions — open the correct editor modal from anywhere.
// Each action loads its dependencies, then opens the relevant modal.
// =====================================================================

import { api } from './api.js';
import { openBlockModal } from './block-editor.js';
import { openTaskModal } from './task-editor.js';
import { openHabitModal } from './habit-editor.js';

async function loadCategories() {
  try {
    const res = await api.list('categories');
    return (res && res.data) || [];
  } catch (e) {
    return [];
  }
}

export async function newBlock(existing, preset) {
  const categories = await loadCategories();
  return openBlockModal({ categories: categories, existing: existing || null, preset: preset || null });
}

export async function newTask(existing) {
  const categories = await loadCategories();
  return openTaskModal({ categories: categories, existing: existing || null });
}

export async function newHabit(existing) {
  return openHabitModal({ existing: existing || null });
}
