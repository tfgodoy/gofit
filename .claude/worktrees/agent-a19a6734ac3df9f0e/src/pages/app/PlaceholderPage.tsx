import { Construction } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";

interface Props {
  title: string;
}

export default function PlaceholderPage({ title }: Props) {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Construction className="w-8 h-8 text-primary/40" />
        </div>
        <h1 className="text-xl font-bold text-gray-700">{title}</h1>
        <p className="text-sm text-gray-400 max-w-xs">
          Módulo em desenvolvimento. Em breve disponível.
        </p>
      </div>
    </AppLayout>
  );
}
