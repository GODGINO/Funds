import { SyncMetadata } from '../types';

export const GIST_ID = '32c1c67e4610e63f15aa68041282cad7';
export const GIST_FILENAME = 'fund_data.json';
export const EXPORT_FILENAME = 'fishing_funds.json';
export const METADATA_FILENAME = 'sync_metadata.json';
export const MARKET_HISTORY_FILENAME = 'market_history.json';

export async function fetchGistData(token?: string): Promise<{ fundData: string; metadata: SyncMetadata | null; marketHistory: string }> {
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    
    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const fundDataFile = data.files ? data.files[GIST_FILENAME] : null;
    const metadataFile = data.files ? data.files[METADATA_FILENAME] : null;
    const marketHistoryFile = data.files ? data.files[MARKET_HISTORY_FILENAME] : null;

    let fundData = '';
    if (fundDataFile && fundDataFile.content) {
        fundData = fundDataFile.content;
    } else if (data.files && Object.values(data.files).length > 0) {
        // Fallback to first file if GIST_FILENAME is not matched (legacy support)
        const firstFile = Object.values(data.files)[0] as any;
        if (firstFile.filename !== METADATA_FILENAME && firstFile.filename !== MARKET_HISTORY_FILENAME) {
            fundData = firstFile.content || '';
        }
    }

    let metadata: SyncMetadata | null = null;
    if (metadataFile && metadataFile.content) {
        try {
            metadata = JSON.parse(metadataFile.content);
        } catch (e) {
            console.warn("Failed to parse sync metadata from Gist", e);
        }
    }

    const marketHistory = (marketHistoryFile && marketHistoryFile.content) ? marketHistoryFile.content : '{}';

    return { fundData, metadata, marketHistory };
}

/**
 * 通用的 Gist 更新函数，支持一次更新多个文件
 */
export async function updateGistFiles(token: string, files: Record<string, { content: string | null }>): Promise<void> {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files })
    });

    if (!response.ok) {
         let errorMsg = `${response.status} ${response.statusText}`;
         try {
             const errData = await response.json();
             if (errData.message) errorMsg += `: ${errData.message}`;
         } catch (e) {}
         throw new Error(errorMsg);
    }
}

export async function updateGistData(token: string, content: string, exportContent: string, metadata?: SyncMetadata): Promise<void> {
      const files: any = {
          [GIST_FILENAME]: {
              content: content
          },
          [EXPORT_FILENAME]: {
              content: exportContent
          }
      };

      if (metadata) {
          files[METADATA_FILENAME] = {
              content: JSON.stringify(metadata, null, 2)
          };
      }
      
      return updateGistFiles(token, files);
}