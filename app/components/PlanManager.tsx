'use client';

import { FormEvent, useEffect, useState } from 'react';

type PlanItem = { id: string; title: string; status: 'pending' | 'completed' };
type Plan = { id: string; title: string; status: 'active' | 'completed'; items: PlanItem[] };

export function PlanManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState('');
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const load = async () => { const response = await fetch('/api/plans'); if (response.ok) setPlans((await response.json()).plans); };
  useEffect(() => { void load(); }, []);
  const addPlan = async (event: FormEvent) => {
    event.preventDefault(); if (!title.trim()) return;
    const response = await fetch('/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    if (!response.ok) { setError('Could not create plan.'); return; }
    const { plan } = await response.json(); setPlans((current) => [{ ...plan, items: [] }, ...current]); setTitle('');
  };
  const togglePlan = async (plan: Plan) => {
    const response = await fetch(`/api/plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: plan.status === 'active' ? 'completed' : 'active' }) });
    if (response.ok) { const { plan: updated } = await response.json(); setPlans((current) => current.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry)); }
  };
  const addItem = async (plan: Plan, event: FormEvent) => {
    event.preventDefault(); const draft = itemDrafts[plan.id]?.trim(); if (!draft) return;
    const response = await fetch(`/api/plans/${plan.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draft }) });
    if (!response.ok) { setError('Could not add item.'); return; }
    const { item } = await response.json(); setPlans((current) => current.map((entry) => entry.id === plan.id ? { ...entry, items: [...entry.items, item] } : entry)); setItemDrafts((current) => ({ ...current, [plan.id]: '' }));
  };
  const toggleItem = async (plan: Plan, item: PlanItem) => {
    const response = await fetch(`/api/plans/${plan.id}/items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: item.status === 'pending' ? 'completed' : 'pending' }) });
    if (response.ok) { const { item: updated } = await response.json(); setPlans((current) => current.map((entry) => entry.id === plan.id ? { ...entry, items: entry.items.map((candidate) => candidate.id === item.id ? updated : candidate) } : entry)); }
  };
  return <div className="card plans-card"><div className="cardhead"><h2>Plans</h2><span>{plans.length}</span></div><form className="goalform" onSubmit={addPlan}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New plan" /><button className="primary">Add</button></form>{error && <p className="error">{error}</p>}{plans.length ? plans.map((plan) => <div className="plan" key={plan.id}><button className={`goal ${plan.status}`} onClick={() => togglePlan(plan)}>{plan.status === 'completed' ? '✓' : '○'} {plan.title}</button><div className="plan-items">{plan.items.map((item) => <button className={`goal ${item.status === 'completed' ? 'completed' : ''}`} onClick={() => toggleItem(plan, item)} key={item.id}>{item.status === 'completed' ? '✓' : '○'} {item.title}</button>)}</div><form className="goalform" onSubmit={(event) => addItem(plan, event)}><input value={itemDrafts[plan.id] || ''} onChange={(event) => setItemDrafts((current) => ({ ...current, [plan.id]: event.target.value }))} placeholder="Add a step" /><button className="link">Add step</button></form></div>) : <p className="muted">Turn your goal into a simple plan.</p>}</div>;
}
