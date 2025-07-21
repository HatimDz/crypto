import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface CryptoSelectorProps {
  selectedCrypto: string;
  onCryptoChange: (crypto: string) => void;
}

// Popular cryptocurrencies supported by Binance
const CRYPTOCURRENCIES = [
  { id: "BTC", name: "Bitcoin", symbol: "BTC" },
  { id: "ETH", name: "Ethereum", symbol: "ETH" },
  { id: "BNB", name: "BNB", symbol: "BNB" },
  { id: "ADA", name: "Cardano", symbol: "ADA" },
  { id: "SOL", name: "Solana", symbol: "SOL" },
  { id: "DOT", name: "Polkadot", symbol: "DOT" },
  { id: "LINK", name: "Chainlink", symbol: "LINK" },
  { id: "LTC", name: "Litecoin", symbol: "LTC" },
  { id: "MATIC", name: "Polygon", symbol: "MATIC" },
  { id: "AVAX", name: "Avalanche", symbol: "AVAX" },
];

export const CryptoSelector = ({ selectedCrypto, onCryptoChange }: CryptoSelectorProps) => {
  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Select Cryptocurrency</h2>
      </div>
      
      <Select value={selectedCrypto} onValueChange={onCryptoChange}>
        <SelectTrigger className="w-full bg-background border-border">
          <SelectValue placeholder="Choose a cryptocurrency" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {CRYPTOCURRENCIES.map((crypto) => (
            <SelectItem 
              key={crypto.id} 
              value={crypto.id}
              className="hover:bg-secondary focus:bg-secondary"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{crypto.symbol}</span>
                <span className="text-muted-foreground">{crypto.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};