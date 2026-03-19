/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import type { BlogTopic } from '../../fetch/blogAi';
import { STATUS_CONFIG, approveTopic, rejectTopic, generateArticle } from '../../fetch/blogAi';

interface TopicCardProps {
  topic: BlogTopic;
  strapiUrl: string;
  onUpdate: () => Promise<void> | void;
}

export function TopicCard({ topic, strapiUrl, onUpdate }: TopicCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const status = STATUS_CONFIG[topic.stage] || STATUS_CONFIG.proposed;

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      await approveTopic(topic.documentId);
      await onUpdate();
    } catch (err: any) {
      setError(err?.message || 'Chyba');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError('');
    try {
      await rejectTopic(topic.documentId);
      await onUpdate();
    } catch (err: any) {
      setError(err?.message || 'Chyba');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm('Generovat článek? Trvá to 30-60 sekund.')) return;
    setLoading(true);
    setError('');
    try {
      await generateArticle(topic.documentId);
      await onUpdate();
    } catch (err: any) {
      setError(err?.message || 'Chyba při generování');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-gray-800 text-sm leading-snug">{topic.title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${status.bg} ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xss font-normal text-gray-500 leading-relaxed mb-3">{topic.description}</p>

      {/* Keywords */}
      {topic.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {topic.keywords.map((kw, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="text-[11px] text-gray-400 mb-3">
        {topic.scheduledDate && <span className={'block mb-2'}>Date: <span className={'inline-block px-1.5 py-0.5 bg-green-100 text-gray-500 rounded'}>{formatDate(topic.scheduledDate)}</span></span>}
        <span className={'block mb-2'}>Slug:  <span className={'font-bold text-yellow-800'}>/{topic.targetSlug}</span></span>
        {topic.internalLinks?.length > 0 && (
          <div className={'flex gap-3'}>
            <span>Links:</span>
            <div>
              {topic.internalLinks.map(item => <div className={'mb-1'}><span className={'inline-block px-1.5 py-0.5 bg-blue-100 text-gray-500 rounded'}>{item}</span></div>)}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {topic.stage === 'proposed' && (
          <>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Ukládám...' : 'Schválit'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Zamítnout
            </button>
          </>
        )}

        {topic.stage === 'approved' && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Generuji článek...' : 'Generovat článek'}
          </button>
        )}

        {topic.stage === 'generating' && (
          <div className="flex items-center gap-1.5 text-purple-600 text-xs">
            <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            Generování...
          </div>
        )}

        {topic.stage === 'generated' && topic.blog && (
          <a
            href={`${strapiUrl}/admin/content-manager/collection-types/api::blog.blog/${topic.blog.documentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
          >
            Otevřít ve Strapi
          </a>
        )}
      </div>
    </div>
  );
}
