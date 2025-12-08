import { useState, useEffect } from 'react';
import {
  UsersIcon,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  FileTextIcon,
  GlobeIcon,
  XIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CalendarIcon,
  HashIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client, ClientInvoice, ClientWebsite, Website } from '../types';

interface ClientDetailProps {
  clientId: string;
  onClose: () => void;
  onNavigateToWebsite?: (websiteId: string) => void;
}

interface ClientWebsiteWithDetails extends ClientWebsite {
  website?: Website | null;
}

export function ClientDetail({ clientId, onClose, onNavigateToWebsite }: ClientDetailProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [websites, setWebsites] = useState<ClientWebsiteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  async function loadClientData() {
    setLoading(true);

    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();

    const { data: invoicesData } = await supabase
      .from('client_invoices')
      .select('*')
      .eq('client_id', clientId)
      .order('invoice_date', { ascending: false });

    const { data: clientWebsitesData } = await supabase
      .from('client_websites')
      .select('*')
      .eq('client_id', clientId);

    const websitesWithDetails = await Promise.all(
      (clientWebsitesData || []).map(async (cw) => {
        if (cw.website_id) {
          const { data: websiteData } = await supabase
            .from('websites')
            .select('*')
            .eq('id', cw.website_id)
            .maybeSingle();

          return {
            ...cw,
            website: websiteData,
          };
        }
        return {
          ...cw,
          website: null,
        };
      })
    );

    setClient(clientData);
    setInvoices(invoicesData || []);
    setWebsites(websitesWithDetails);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-gray-500">Načítání...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-gray-500">Klient nebyl nalezen</p>
      </div>
    );
  }

  const overdueInvoices = invoices.filter(inv => inv.status?.includes('splatnosti'));
  const paidInvoices = invoices.filter(inv => inv.status?.toLowerCase().includes('uhrazena'));

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900">{client.name}</h1>
                {overdueInvoices.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                    <AlertCircleIcon className="w-3 h-3" />
                    {overdueInvoices.length} po splatnosti
                  </span>
                )}
              </div>
              {client.company_name && (
                <p className="text-sm text-gray-500 mt-0.5">{client.company_name}</p>
              )}
            </div>
          </div>
          {client.portal_link && (
            <a
              href={client.portal_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ExternalLinkIcon className="w-4 h-4" />
              Zobrazit v portálu
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BuildingIcon className="w-4 h-4" />
                Kontaktní údaje
              </h3>
              <div className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <MailIcon className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                      {client.email}
                    </a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                      {client.phone}
                    </a>
                  </div>
                )}
                {(client.street || client.city || client.postal_code) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      {client.street && <div>{client.street}</div>}
                      {(client.city || client.postal_code) && (
                        <div>
                          {client.postal_code && `${client.postal_code} `}
                          {client.city}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(client.ic || client.dic) && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <HashIcon className="w-4 h-4" />
                  Fakturační údaje
                </h3>
                <div className="space-y-2">
                  {client.ic && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">IČ:</span>
                      <span className="font-medium text-gray-900">{client.ic}</span>
                    </div>
                  )}
                  {client.dic && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">DIČ:</span>
                      <span className="font-medium text-gray-900">{client.dic}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {websites.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GlobeIcon className="w-4 h-4" />
                  Weby ({websites.length})
                </h3>
                <div className="space-y-2">
                  {websites.map((cw) => (
                    <div
                      key={cw.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GlobeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <a
                          href={cw.website_url.startsWith('http') ? cw.website_url : `https://${cw.website_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {cw.website_url}
                        </a>
                      </div>
                      {cw.website_id && onNavigateToWebsite && (
                        <button
                          onClick={() => onNavigateToWebsite(cw.website_id!)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                        >
                          Zobrazit detail
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileTextIcon className="w-4 h-4" />
                Faktury ({invoices.length})
              </h3>

              {invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileTextIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Žádné faktury</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-100 rounded"></div>
                      <span className="text-gray-600">{paidInvoices.length} uhrazených</span>
                    </div>
                    {overdueInvoices.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-100 rounded"></div>
                        <span className="text-gray-600">{overdueInvoices.length} po splatnosti</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {invoices.map((invoice) => {
                      const isOverdue = invoice.status?.includes('splatnosti');
                      const isPaid = invoice.status?.toLowerCase().includes('uhrazena');

                      return (
                        <button
                          key={invoice.id}
                          onClick={() => setSelectedInvoice(invoice)}
                          className={`w-full p-3 rounded-lg border text-left hover:shadow-md transition-all ${
                            isOverdue
                              ? 'bg-red-50 border-red-200 hover:bg-red-100'
                              : isPaid
                              ? 'bg-green-50 border-green-200 hover:bg-green-100'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isOverdue ? (
                                <AlertCircleIcon className="w-4 h-4 text-red-600" />
                              ) : isPaid ? (
                                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                              ) : (
                                <FileTextIcon className="w-4 h-4 text-gray-400" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  #{invoice.invoice_number}
                                </p>
                                {invoice.invoice_date && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <CalendarIcon className="w-3 h-3 text-gray-400" />
                                    <p className="text-xs text-gray-500">{invoice.invoice_date}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            {invoice.status && (
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded ${
                                  isOverdue
                                    ? 'bg-red-100 text-red-700'
                                    : isPaid
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {invoice.status}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Detail faktury</h2>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Číslo faktury
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      #{selectedInvoice.invoice_number}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stav
                    </label>
                    <span
                      className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                        selectedInvoice.status?.includes('splatnosti')
                          ? 'bg-red-100 text-red-700'
                          : selectedInvoice.status?.toLowerCase().includes('uhrazena')
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedInvoice.status || 'Neznámý'}
                    </span>
                  </div>
                </div>

                {selectedInvoice.invoice_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datum vystavení
                    </label>
                    <div className="flex items-center gap-2 text-gray-900">
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                      <p className="text-base">{selectedInvoice.invoice_date}</p>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Informace o klientovi</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Jméno:</span>
                      <span className="text-sm font-medium text-gray-900">{client?.name}</span>
                    </div>
                    {client?.company_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Společnost:</span>
                        <span className="text-sm font-medium text-gray-900">{client.company_name}</span>
                      </div>
                    )}
                    {client?.ic && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">IČ:</span>
                        <span className="text-sm font-medium text-gray-900">{client.ic}</span>
                      </div>
                    )}
                    {client?.dic && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">DIČ:</span>
                        <span className="text-sm font-medium text-gray-900">{client.dic}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedInvoice.status?.includes('splatnosti') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-red-900 mb-1">Faktura po splatnosti</h3>
                        <p className="text-sm text-red-700">
                          Tato faktura je po datu splatnosti a měla by být uhrazena co nejdříve.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedInvoice.status?.toLowerCase().includes('uhrazena') && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-green-900 mb-1">Faktura uhrazena</h3>
                        <p className="text-sm text-green-700">
                          Tato faktura byla úspěšně uhrazena.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
