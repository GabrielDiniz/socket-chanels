// src/app/panel/page.tsx — Controller de estado: PairingView (show code) vs ActiveView

"use client";

import PairingView from './_components/PairingView';
import ActiveView from './_components/ActiveView';
import usePairing from '../../hooks/usePairing';

export default function PanelPage() {
  const {
    isPaired,
    channelSlug,
    token, // CORREÇÃO: Recebendo o token do hook
    generatedCode,
    timeLeft,
    formatTime,
    generateNewCode,
    clearPairing,
  } = usePairing();

  return (
    <main className="flex h-screen items-center justify-center bg-blue-900 text-white">
      {isPaired && token && channelSlug ? (
        <ActiveView 
          channelSlug={channelSlug} 
          token={token} // CORREÇÃO: Passando o token para a view ativa
          clearPairing={clearPairing} 
        />
      ) : (
        <PairingView
          generatedCode={generatedCode}
          timeLeft={timeLeft}
          formatTime={formatTime}
          generateNewCode={generateNewCode}
        />
      )}
    </main>
  );
}