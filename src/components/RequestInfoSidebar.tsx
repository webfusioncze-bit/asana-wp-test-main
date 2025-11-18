import { ExternalLink as ExternalLinkIcon, User as UserIcon } from 'lucide-react';
import type { Request } from '../types';

interface RequestInfoSidebarProps {
  request: Request;
}

export default function RequestInfoSidebar({ request }: RequestInfoSidebarProps) {
  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-6 space-y-6">
      {(request.client_name || request.client_email || request.client_phone) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-300 pb-2">
            Informace o klientovi
          </h4>
          {request.client_name && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <UserIcon className="w-4 h-4" />
                Jméno
              </div>
              <div className="text-gray-900 font-medium">{request.client_name}</div>
            </div>
          )}
          {request.client_email && (
            <div className="space-y-1">
              <div className="text-gray-500 text-xs">Email</div>
              <a
                href={`mailto:${request.client_email}`}
                className="text-primary hover:underline block break-all text-sm"
              >
                {request.client_email}
              </a>
            </div>
          )}
          {request.client_phone && (
            <div className="space-y-1">
              <div className="text-gray-500 text-xs">Telefon</div>
              <a
                href={`tel:${request.client_phone}`}
                className="text-primary hover:underline block text-sm"
              >
                {request.client_phone}
              </a>
            </div>
          )}
        </div>
      )}

      {(request.subpage_count > 0 || request.source || request.current_website_url || request.storage_url) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-300 pb-2">
            Detaily projektu
          </h4>
          {request.subpage_count > 0 && (
            <div className="space-y-1">
              <div className="text-gray-500 text-xs">Počet podstránek</div>
              <div className="text-gray-900 font-medium">{request.subpage_count}</div>
            </div>
          )}
          {request.source && (
            <div className="space-y-1">
              <div className="text-gray-500 text-xs">Zdroj</div>
              <div className="text-gray-900 text-sm">{request.source}</div>
            </div>
          )}
          {request.current_website_url && (
            <div className="space-y-1">
              <div className="text-gray-500 text-xs">Aktuální web</div>
              <a
                href={request.current_website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 break-all text-sm"
              >
                {request.current_website_url}
                <ExternalLinkIcon className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
          {request.storage_url && (
            <div className="space-y-1">
              <div className="text-gray-500 text-xs">Uložiště</div>
              <a
                href={request.storage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-sm"
              >
                Odkaz na uložiště
                <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
