// src/app/panel/_components/ActiveView.tsx — View ativa (exibe channel pareado, botão desparear futuro)

interface ActiveViewProps {
  channelSlug: string;
  clearPairing: () => void;
}

export default function ActiveView({ channelSlug, clearPairing }: ActiveViewProps) {
  return (
    <div className="text-center">
      <h2 data-testid="active-view-heading" className="text-6xl font-bold mb-12">
        Canal Pareado: {channelSlug}
      </h2>
      <p className="text-5xl text-green-400 mb-8">Conectado e pronto!</p>
      <div className="mt-32">
        <p className="text-8xl">Aguardando próxima chamada...</p>
      </div>
      {/* Futuro: botão desparear <button onClick={clearPairing}>Desparear TV</button> */}
    </div>
  );
}