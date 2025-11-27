
export const GIST_ID = '32c1c67e4610e63f15aa68041282cad7';
export const GIST_FILENAME = 'fund_data.json';

export async function fetchGistData(token: string): Promise<string> {
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    
    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const file = data.files ? (data.files[GIST_FILENAME] || Object.values(data.files)[0]) : null;

    if (file && file.content) {
        return file.content;
    } else {
        throw new Error('Gist 中未找到有效文件内容。');
    }
}

export async function updateGistData(token: string, content: string): Promise<void> {
      const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
          method: 'PATCH',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              files: {
                  [GIST_FILENAME]: {
                      content: content
                  }
              }
          })
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
