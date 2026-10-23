import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ToastProvider } from "@/components/ui/toast";
import { WalletProvider } from "@/hooks/useWallet";
import { Landing } from "@/pages/Landing";
import { HowItWorks } from "@/pages/HowItWorks";
import { Features } from "@/pages/Features";
import { AppPage } from "@/pages/AppPage";

export default function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/features" element={<Features />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="*" element={<Landing />} />
          </Route>
        </Routes>
      </WalletProvider>
    </ToastProvider>
  );
}
