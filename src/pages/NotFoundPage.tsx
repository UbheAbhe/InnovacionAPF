import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="panel">
      <EmptyState icon={MapPinOff} title="Esta sección no existe">
        <Link to="/" className="font-semibold text-brand hover:underline">
          Volver al dashboard
        </Link>
      </EmptyState>
    </div>
  );
}
