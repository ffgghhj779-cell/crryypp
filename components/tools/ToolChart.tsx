'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import type { Kline } from '@/lib/binance/fetcher';

export interface OverlaySeries {
  type: 'line' | 'histogram';
  data: { time: number; value: number; color?: string }[];
  color?: string;
  lineWidth?: 1 | 2 | 3 | 4;
  title?: string;
  priceScaleId?: string; // e.g. 'left' or custom string for oscillators
}

export interface HorizontalLine {
  price: number;
  color: string;
  title: string;
  lineWidth?: 1 | 2 | 3 | 4;
  lineStyle?: number; // 0: Solid, 1: Dotted, 2: Dashed
}

export interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  color: string;
  text?: string;
  size?: number;
}

interface ToolChartProps {
  klines: Kline[];
  overlays?: OverlaySeries[];
  priceLines?: HorizontalLine[];
  markers?: ChartMarker[];
  height?: number;
  hideGrid?: boolean;
  hideCandles?: boolean;
}

export function ToolChart({ klines, overlays = [], priceLines = [], markers = [], height = 400, hideGrid = true, hideCandles = false }: ToolChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || klines.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#888',
      },
      grid: {
        vertLines: { visible: !hideGrid, color: '#1a1a1a' },
        horzLines: { visible: !hideGrid, color: '#1a1a1a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1a1a1a',
      },
      rightPriceScale: {
        borderColor: '#1a1a1a',
      },
      leftPriceScale: {
        borderColor: '#1a1a1a',
        visible: overlays.some(o => o.priceScaleId === 'left'),
      },
      crosshair: {
        mode: 1, // Normal mode
      }
    });
    chartRef.current = chart;

    // 1. Add Candlesticks
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#ef4444', // red-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      visible: !hideCandles,
    });

    const candleData = klines.map((k) => ({
      time: Math.floor(k.time) as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      color: k.color,
      borderColor: k.borderColor,
      wickColor: k.wickColor,
    }));
    
    // Sort by time just in case
    candleData.sort((a, b) => (a.time as number) - (b.time as number));

    // Remove duplicates
    const uniqueCandles = [];
    const seenTimes = new Set();
    for (const c of candleData) {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        uniqueCandles.push(c);
      }
    }

    candlestickSeries.setData(uniqueCandles);

    if (markers.length > 0) {
      createSeriesMarkers(candlestickSeries, markers.map(m => ({ ...m, time: Math.floor(m.time) as Time })).sort((a, b) => (a.time as number) - (b.time as number)));
    }

    // 2. Add Horizontal Price Lines (e.g. Fib levels)
    for (const line of priceLines) {
      candlestickSeries.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: line.lineWidth || 1,
        lineStyle: line.lineStyle || 0,
        axisLabelVisible: true,
        title: line.title,
      });
    }

    // 3. Add Overlays (e.g. Moving Averages, Keltner Channels)
    for (const overlay of overlays) {
      if (overlay.type === 'line') {
        const lineSeries = chart.addSeries(LineSeries, {
          color: overlay.color || '#ff6a00',
          lineWidth: overlay.lineWidth || 2,
          title: overlay.title,
          priceScaleId: overlay.priceScaleId || 'right',
        });
        
        const safeData = overlay.data
          .filter(d => !isNaN(d.value))
          .map(d => ({ time: Math.floor(d.time) as Time, value: d.value }));
          
        safeData.sort((a, b) => (a.time as number) - (b.time as number));
        
        const uniqueData = [];
        const seen = new Set();
        for (const d of safeData) {
          if (!seen.has(d.time)) {
            seen.add(d.time);
            uniqueData.push(d);
          }
        }
        
        if (uniqueData.length > 0) {
          lineSeries.setData(uniqueData);
        }
      } else if (overlay.type === 'histogram') {
        const histogramSeries = chart.addSeries(HistogramSeries, {
          color: overlay.color || '#ff6a00',
          title: overlay.title,
          priceScaleId: overlay.priceScaleId || 'right',
        });
        
        const safeData = overlay.data
          .filter(d => !isNaN(d.value))
          .map(d => ({ time: Math.floor(d.time) as Time, value: d.value, color: d.color }));
          
        safeData.sort((a, b) => (a.time as number) - (b.time as number));
        
        const uniqueData = [];
        const seen = new Set();
        for (const d of safeData) {
          if (!seen.has(d.time)) {
            seen.add(d.time);
            uniqueData.push(d);
          }
        }
        
        if (uniqueData.length > 0) {
          histogramSeries.setData(uniqueData);
        }
      }
    }

    chart.timeScale().fitContent();

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [klines, overlays, priceLines, height, hideGrid, hideCandles, markers]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full rounded-xl overflow-hidden border border-white/10"
      style={{ height }}
    />
  );
}
