// =====================================================================
// Palette commands — static navigation, create actions, live data.
// =====================================================================

import { api } from './api.js';
import { newBlock, newTask, newHabit } from './actions.js';
import { openFromDayDialog } from './template-editor.js';
import { openApplyTemplate } from './apply-template.js';

export async function getPaletteCommands() {
  const cmds = [];

  cmds.push({ label: 'Today',      subtitle: 'Daily timeline',       group: 'Navigate', run: function () { location.hash = '#/today'; } });
  cmds.push({ label: 'Week',       subtitle: 'Weekly grid',          group: 'Navigate', run: function () { location.hash = '#/week'; } });
  cmds.push({ label: 'Month',      subtitle: 'Monthly calendar',     group: 'Navigate', run: function () { location.hash = '#/month'; } });
  cmds.push({ label: 'Blocks',     subtitle: 'All blocks',           group: 'Navigate', run: function () { location.hash = '#/blocks'; } });
  cmds.push({ label: 'Templates',  subtitle: 'Reusable day shapes',  group: 'Navigate', run: function () { location.hash = '#/templates'; } });
  cmds.push({ label: 'Tasks',      subtitle: 'Task list',            group: 'Navigate', run: function () { location.hash = '#/tasks'; } });
  cmds.push({ label: 'Habits',     subtitle: 'Habit tracker',        group: 'Navigate', run: function () { location.hash = '#/habits'; } });
  cmds.push({ label: 'Stats',      subtitle: 'Statistics',           group: 'Navigate', run: function () { location.hash = '#/stats'; } });
  cmds.push({ label: 'Categories', subtitle: 'Manage categories',    group: 'Navigate', run: function () { location.hash = '#/categories'; } });
  cmds.push({ label: 'Settings',   subtitle: 'Preferences',          group: 'Navigate', run: function () { location.hash = '#/settings'; } });

  cmds.push({ label: 'New block',      subtitle: 'Add a time block',  group: 'Create', run: function () { newBlock(); } });
  cmds.push({ label: 'New task',       subtitle: 'Add a task',        group: 'Create', run: function () { newTask(); } });
  cmds.push({ label: 'New habit',      subtitle: 'Add a habit',       group: 'Create', run: function () { newHabit(); } });
  cmds.push({ label: 'Save day as template', subtitle: 'Pick a day to capture', group: 'Create', run: function () { openFromDayDialog(); } });

  cmds.push({ label: 'Apply template', subtitle: 'Replay a day onto a date range', group: 'Templates', run: function () { openApplyTemplate(); } });

  // Dynamic items
  const results = await Promise.all([
    api.list('blocks').catch(function () { return null; }),
    api.list('tasks').catch(function () { return null; }),
    api.list('habits').catch(function () { return null; }),
    api.list('templates').catch(function () { return null; })
  ]);
  const blocksRes = results[0];
  const tasksRes = results[1];
  const habitsRes = results[2];
  const tplRes = results[3];

  if (blocksRes && Array.isArray(blocksRes.data)) {
    for (let i = 0; i < blocksRes.data.length; i++) {
      (function (b) {
        cmds.push({
          label: b.title,
          subtitle: 'Block \u00B7 ' + b.start + ' \u2013 ' + b.end,
          group: 'Edit blocks',
          run: function () { newBlock(b); }
        });
      })(blocksRes.data[i]);
    }
  }

  if (tplRes && Array.isArray(tplRes.data)) {
    for (let i = 0; i < tplRes.data.length; i++) {
      (function (t) {
        cmds.push({
          label: t.name,
          subtitle: 'Template \u00B7 ' + (t.blocks || []).length + ' blocks',
          group: 'Apply template',
          run: function () { openApplyTemplate({ preselectTemplateId: t.id }); }
        });
      })(tplRes.data[i]);
    }
  }

  if (tasksRes && Array.isArray(tasksRes.data)) {
    for (let i = 0; i < tasksRes.data.length; i++) {
      (function (t) {
        const dueLabel = t.dueDate ? ('due ' + t.dueDate) : 'no due date';
        cmds.push({
          label: t.title,
          subtitle: 'Task \u00B7 ' + (t.done ? 'done' : dueLabel),
          group: 'Edit tasks',
          run: function () { newTask(t); }
        });
      })(tasksRes.data[i]);
    }
  }

  if (habitsRes && Array.isArray(habitsRes.data)) {
    for (let i = 0; i < habitsRes.data.length; i++) {
      (function (h) {
        cmds.push({
          label: h.title,
          subtitle: 'Habit',
          group: 'Edit habits',
          run: function () { newHabit(h); }
        });
      })(habitsRes.data[i]);
    }
  }

  return cmds;
}
