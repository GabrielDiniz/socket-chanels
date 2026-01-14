// src/app/panel/_components/PairingView.tsx — View de pareamento na TV (mostra código gerado, countdown, refresh optional)

interface PairingViewProps {
  generatedCode: string;
  timeLeft: number;
  formatTime: (seconds: number) => string;
  generateNewCode: () => void;
}

export default function PairingView({
  generatedCode,
  timeLeft,
  formatTime,
  generateNewCode,
}: PairingViewProps) {
  return (
    <div className="text-center">
      <h2 className="text-6xl font-bold mb-12">Parear esta TV</h2>
      <p className="text-4xl mb-8">Digite este código no Painel Admin:</p>
      <div data-testid="generated-code" className="text-9xl font-bold mb-12 tracking-widest">
        {generatedCode || 'Gerando...'}
      </div>
      <p className="text-5xl mb-8 text-yellow-300">Expira em: {formatTime(timeLeft)}</p>
      <p className="text-3xl opacity-70">Atualize a página para novo código se necessário</p>
      {/* Futuro: button refresh <button onClick={generateNewCode}>Novo Código</button> */}
    </div>
  );
}