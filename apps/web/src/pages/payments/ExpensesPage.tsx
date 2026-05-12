import { useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track community expenses</p>
        </div>
        <Button icon={<Plus size={16} />}>Add Expense</Button>
      </div>
      <div className="card p-8">
        <EmptyState icon={Receipt} title="No expenses recorded" description="Start tracking community expenses here" />
      </div>
    </div>
  );
}
