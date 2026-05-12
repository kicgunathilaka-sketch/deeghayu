import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle, XCircle, QrCode, Camera } from 'lucide-react';
import { attendanceApi } from '../../api/attendance.api';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

type ScanResult = {
  success: boolean;
  message: string;
  isLate?: boolean;
  event?: { title: string };
};

export default function QRScanPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    scannerRef.current = new Html5Qrcode('qr-reader');
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    setError('');
    setResult(null);
    try {
      await scannerRef.current!.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scannerRef.current!.stop();
          setIsScanning(false);
          await processQr(decodedText);
        },
        undefined
      );
      setIsScanning(true);
    } catch (err: any) {
      setError('Camera access denied. Please allow camera permission.');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  };

  const processQr = async (payload: string) => {
    setLoading(true);
    try {
      const res = await attendanceApi.scan(payload);
      setResult({ success: true, ...res.data });
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message || 'Check-in failed' });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">Scan QR Code</h1>
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`card p-6 text-center ${result.success ? 'border-emerald-500' : 'border-red-500'} border-2`}
          >
            {result.success ? (
              <>
                <CheckCircle size={56} className="text-emerald-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {result.isLate ? 'Checked In (Late)' : 'Checked In!'}
                </h2>
                {result.event && <p className="text-slate-500 text-sm">{result.event.title}</p>}
                {result.isLate && (
                  <p className="text-amber-500 text-sm mt-2">⚠️ You were marked as late</p>
                )}
              </>
            ) : (
              <>
                <XCircle size={56} className="text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Check-in Failed</h2>
                <p className="text-slate-500 text-sm">{result.message}</p>
              </>
            )}
            <Button className="mt-4" onClick={reset}>Scan Another</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <>
          {/* QR Reader Container */}
          <div className="card overflow-hidden">
            <div id="qr-reader" className="w-full" />
            {!isScanning && (
              <div className="p-8 text-center">
                <div className="w-24 h-24 bg-surface-100 dark:bg-surface-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <QrCode size={40} className="text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm mb-4">Point your camera at the event QR code to check in</p>
                <Button icon={<Camera size={16} />} onClick={startScanning} loading={loading}>
                  Start Camera
                </Button>
              </div>
            )}
          </div>

          {isScanning && (
            <Button variant="secondary" className="w-full" onClick={stopScanning}>Stop Scanner</Button>
          )}

          {error && (
            <div className="card p-4 border-red-300 border bg-red-50 dark:bg-red-900/20">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="card p-4 text-sm text-slate-500">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">How to check in:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tap "Start Camera"</li>
              <li>Point at the event QR code displayed at the venue</li>
              <li>Your attendance will be automatically recorded</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
