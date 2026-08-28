'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { CsvUploader } from './CsvUploader';
import { emailsApi, sendersApi } from '@/lib/api';
import { toast } from '@/components/ui/Toast';

import type { Sender } from '@/types/email';

// ─── Constants ───────────────────────────────────────────────────────────────

const EMOJIS = [
  '😀','😊','😂','😍','🥰','😎',
  '🤝','👋','👍','👏','🙏','💯',
  '🔥','✨','🎉','🚀','❤️','💙',
  '💚','⭐','📧','💼','📈','🎯',
];

const MAX_FILE_SIZE   = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SIZE  = 25 * 1024 * 1024; // 25 MB total
const MAX_FILE_COUNT  = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getFileIcon(mime: string): string {
  if (mime.startsWith('image/'))       return '🖼️';
  if (mime === 'application/pdf')      return '📄';
  if (mime.includes('word'))           return '📝';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  if (mime.includes('zip') || mime.includes('compressed'))    return '🗜️';
  return '📎';
}

// ─── Inline link dialog ───────────────────────────────────────────────────────

interface LinkDialogProps {
  onInsert: (url: string, label: string) => void;
  onClose: () => void;
}

function LinkDialog({ onInsert, onClose }: LinkDialogProps) {
  const [url, setUrl]     = useState('https://');
  const [label, setLabel] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => { urlRef.current?.focus(); }, []);

  const handleInsert = () => {
    let cleanUrl = url.trim();
    if (!cleanUrl) { toast.error('URL is required'); return; }
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
    const linkText = label.trim() || cleanUrl;
    onInsert(cleanUrl, linkText);
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      {/* Panel — stopPropagation keeps clicks inside from closing */}
      <div
        className="w-full max-w-sm rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Insert Link</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <Input
            ref={urlRef}
            label="URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
          />
          <Input
            label="Display text (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Click here"
            onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={handleInsert}>Insert</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ComposeEmailProps {
  onScheduled?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ComposeEmail({ onScheduled }: ComposeEmailProps) {
  // Form state
  const [senders, setSenders]       = useState<Sender[]>([]);
  const [senderId, setSenderId]     = useState('');
  const [subject, setSubject]       = useState('');
  const [body, setBody]             = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [startTime, setStartTime]   = useState('');
  const [delay, setDelay]           = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [loading, setLoading]       = useState(false);

  // Sender creation
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [addingSender, setAddingSender]     = useState(false);

  // Body toolbar
  const [attachments, setAttachments]     = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkDialog, setShowLinkDialog]   = useState(false);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // ── Initialise ─────────────────────────────────────────────────────────────

  useEffect(() => {
    sendersApi.list()
      .then((data) => {
        setSenders(data);
        if (data.length > 0) setSenderId(data[0].id);
      })
      .catch(() => {/* keep UI usable */});

    // Default start: 5 minutes from now
    setStartTime(
      new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16),
    );
  }, []);

  // ── Sender ─────────────────────────────────────────────────────────────────

  const handleAddSender = async () => {
    const email = newSenderEmail.trim();
    if (!email) { toast.error('Enter a sender email'); return; }
    setAddingSender(true);
    try {
      const sender = await sendersApi.create(email);
      setSenders((prev) => [...prev, sender]);
      setSenderId(sender.id);
      setNewSenderEmail('');
      toast.success('Sender added');
    } catch {
      toast.error('Failed to add sender');
    } finally {
      setAddingSender(false);
    }
  };

  // ── Attachments ────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;

    const currentSize = attachments.reduce((s, f) => s + f.size, 0);
    const added: File[] = [];
    let running = currentSize;

    for (const file of incoming) {
      if (attachments.length + added.length >= MAX_FILE_COUNT) {
        toast.error(`Maximum ${MAX_FILE_COUNT} attachments allowed`);
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds the 10 MB per-file limit`);
        continue;
      }
      if (running + file.size > MAX_TOTAL_SIZE) {
        toast.error('Total attachments cannot exceed 25 MB');
        break;
      }
      const isDuplicate = [...attachments, ...added].some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
      );
      if (isDuplicate) continue;
      added.push(file);
      running += file.size;
    }

    if (added.length > 0) setAttachments((prev) => [...prev, ...added]);
    e.target.value = '';
  };

  const removeAttachment = (i: number) =>
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  // ── Emoji ──────────────────────────────────────────────────────────────────

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? body.length;
      const end   = el.selectionEnd   ?? body.length;
      const next  = body.slice(0, start) + emoji + body.slice(end);
      setBody(next);
      // Restore cursor after the inserted emoji
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + emoji.length;
        el.focus();
      });
    } else {
      setBody((b) => b + emoji);
    }
    setShowEmojiPicker(false);
  };

  // ── Link ───────────────────────────────────────────────────────────────────

  const handleLinkInsert = (url: string, linkText: string) => {
    const el    = textareaRef.current;
    const insert = `${linkText}: ${url}`;

    if (el) {
      const start = el.selectionStart ?? body.length;
      const end   = el.selectionEnd   ?? body.length;
      // Put a blank line before the link if there's already content
      const prefix  = start > 0 && body[start - 1] !== '\n' ? '\n\n' : '';
      const next    = body.slice(0, start) + prefix + insert + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        const pos = start + prefix.length + insert.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      });
    } else {
      setBody((b) => (b ? `${b}\n\n${insert}` : insert));
    }
    setShowLinkDialog(false);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderId)          { toast.error('Please select a sender'); return; }
    if (!subject.trim())    { toast.error('Subject is required'); return; }
    if (!body.trim())       { toast.error('Body is required'); return; }
    if (recipients.length === 0) { toast.error('Upload a CSV with at least one valid email'); return; }
    if (!startTime)         { toast.error('Start time is required'); return; }
    if (delay < 0)          { toast.error('Delay cannot be negative'); return; }
    if (hourlyLimit < 1 || hourlyLimit > 1000) { toast.error('Hourly limit must be 1–1000'); return; }

    const totalSize = attachments.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) { toast.error('Total attachments exceed 25 MB'); return; }

    setLoading(true);
    try {
      const result = await emailsApi.schedule(
        {
          senderId,
          subject: subject.trim(),
          body,
          recipients,
          startTime: new Date(startTime).toISOString(),
          delayBetweenEmails: delay,
          hourlyLimit,
        },
        attachments,
      );

      toast.success(
        `✅ Scheduled ${result.scheduledCount} email${result.scheduledCount !== 1 ? 's' : ''}!`,
      );

      // Reset form
      setSubject('');
      setBody('');
      setRecipients([]);
      setInvalidCount(0);
      setAttachments([]);
      setShowEmojiPicker(false);
      onScheduled?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to schedule emails';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalAttachmentSize = attachments.reduce((s, f) => s + f.size, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inline link dialog */}
      {showLinkDialog && (
        <LinkDialog
          onInsert={handleLinkInsert}
          onClose={() => setShowLinkDialog(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── From (Sender) ──────────────────────────────────────────────── */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            From (Sender)
          </label>
          {senders.length > 0 ? (
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>{s.email}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm italic text-gray-500">No senders yet — add one below.</p>
          )}
        </div>

        {/* ── Add Sender ─────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <Input
            placeholder="Add sender email (e.g. you@example.com)"
            value={newSenderEmail}
            onChange={(e) => setNewSenderEmail(e.target.value)}
            type="email"
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="md" loading={addingSender} onClick={handleAddSender}>
            Add Sender
          </Button>
        </div>

        {/* ── Subject ────────────────────────────────────────────────────── */}
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Your email subject"
          required
        />

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 px-2 py-1.5">

            {/* Insert Link */}
            <button
              type="button"
              onClick={() => { setShowEmojiPicker(false); setShowLinkDialog(true); }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-white hover:shadow-sm"
              title="Insert a hyperlink"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Link
            </button>

            <div className="h-4 w-px bg-gray-300" />

            {/* Emoji picker toggle */}
            <button
              type="button"
              onClick={() => { setShowLinkDialog(false); setShowEmojiPicker((p) => !p); }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-white hover:shadow-sm"
              title="Insert emoji"
            >
              😊 Emoji
            </button>

            <div className="h-4 w-px bg-gray-300" />

            {/* Attach file */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachments.length >= MAX_FILE_COUNT}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              title={attachments.length >= MAX_FILE_COUNT ? 'Maximum 5 files reached' : 'Attach files'}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attach
              {attachments.length > 0 && (
                <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                  {attachments.length}
                </span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Emoji picker panel */}
          {showEmojiPicker && (
            <div className="border-x border-gray-300 bg-white px-3 py-2 shadow-sm">
              <div className="flex flex-wrap gap-0.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-md p-1.5 text-lg transition hover:bg-gray-100"
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here...&#10;&#10;Links you insert via the toolbar will appear as:&#10;  Link text: https://example.com"
            rows={8}
            required
            className="rounded-t-none"
          />

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="rounded-b-lg border border-t-0 border-gray-300 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">
                  Attachments ({attachments.length}/{MAX_FILE_COUNT})
                </p>
                <button
                  type="button"
                  onClick={() => setAttachments([])}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Remove all
                </button>
              </div>

              <ul className="space-y-1.5">
                {attachments.map((file, idx) => (
                  <li
                    key={`${file.name}-${file.size}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-base" aria-hidden="true">
                        {getFileIcon(file.type)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-gray-700">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Total size bar */}
              <div className="mt-2">
                <div className="mb-0.5 flex justify-between text-xs text-gray-400">
                  <span>{formatBytes(totalAttachmentSize)} used</span>
                  <span>25 MB limit</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      totalAttachmentSize / MAX_TOTAL_SIZE > 0.8 ? 'bg-red-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${Math.min(100, (totalAttachmentSize / MAX_TOTAL_SIZE) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Recipients (CSV) ───────────────────────────────────────────── */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Recipients (CSV)
          </label>
          <CsvUploader
            onParsed={(valid, invalid) => {
              setRecipients(valid);
              setInvalidCount(invalid);
            }}
          />
          {recipients.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-green-600">✅ {recipients.length} valid email{recipients.length !== 1 ? 's' : ''}</span>
              {invalidCount > 0 && (
                <span className="text-red-500">⚠️ {invalidCount} invalid / skipped</span>
              )}
            </div>
          )}
        </div>

        {/* ── Scheduling ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Start Time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="Delay Between Emails (ms)"
            type="number"
            min={0}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            helpText="Minimum: 0 ms"
          />
          <Input
            label="Hourly Limit"
            type="number"
            min={1}
            max={1000}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
            helpText="Max emails per hour"
          />
        </div>

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Schedule{' '}
          {recipients.length > 0
            ? `${recipients.length} Email${recipients.length !== 1 ? 's' : ''}`
            : 'Emails'}
        </Button>

      </form>
    </>
  );
}
