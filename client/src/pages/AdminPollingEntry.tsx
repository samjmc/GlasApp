/**
 * Admin Polling Data Entry Interface
 * 
 * Allows administrators to manually enter poll results
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PollSource {
  id: number;
  name: string;
  type: string;
}

interface Party {
  id: number;
  name: string;
}

interface PartyResult {
  party_id: number | null;
  party_name: string;
  first_preference: number;
}

export default function AdminPollingEntry() {
  const [sources, setSources] = useState<PollSource[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    source_id: '',
    poll_date: '',
    publication_date: '',
    sample_size: 1000,
    margin_of_error: 3.0,
    methodology: 'online',
    scope: 'national',
    constituency: '',
    verified: true,
    source_url: '',
    article_title: '',
    notes: ''
  });

  const [partyResults, setPartyResults] = useState<PartyResult[]>([]);

  // Load sources and parties
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    // Load poll sources
    const { data: sourcesData } = await supabase
      .from('poll_sources')
      .select('id, name, type')
      .eq('active', true)
      .order('name');

    if (sourcesData) setSources(sourcesData);

    // Load parties
    const { data: partiesData } = await supabase
      .from('parties')
      .select('id, name')
      .order('name');

    if (partiesData) {
      setParties(partiesData);
      
      // Initialize party results
      const initialResults = partiesData.slice(0, 8).map(party => ({
        party_id: party.id,
        party_name: party.name,
        first_preference: 0
      }));
      setPartyResults(initialResults);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handlePartyResultChange = (index: number, value: string) => {
    const percentage = parseFloat(value) || 0;
    setPartyResults(prev => {
      const updated = [...prev];
      updated[index].first_preference = percentage;
      return updated;
    });
  };

  const addPartyResult = () => {
    setPartyResults(prev => [...prev, {
      party_id: null,
      party_name: '',
      first_preference: 0
    }]);
  };

  const removePartyResult = (index: number) => {
    setPartyResults(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return partyResults.reduce((sum, result) => sum + result.first_preference, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      const total = calculateTotal();
      if (Math.abs(total - 100) > 1) {
        alert(`Warning: Total percentages = ${total.toFixed(1)}% (should be ~100%)`);
        if (!confirm('Continue anyway?')) {
          setLoading(false);
          return;
        }
      }

      // Insert poll
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          source_id: parseInt(formData.source_id),
          poll_date: formData.poll_date,
          publication_date: formData.publication_date || formData.poll_date,
          sample_size: formData.sample_size,
          margin_of_error: formData.margin_of_error,
          methodology: formData.methodology,
          scope: formData.scope,
          constituency: formData.scope === 'constituency' ? formData.constituency : null,
          verified: formData.verified,
          source_url: formData.source_url || null,
          article_title: formData.article_title || null,
          notes: formData.notes || null,
          quality_score: 80 // Default for manual entry
        })
        .select('id')
        .single();

      if (pollError) throw pollError;

      // Insert party results
      const resultsToInsert = partyResults
        .filter(r => r.first_preference > 0)
        .map(r => ({
          poll_id: poll.id,
          party_id: r.party_id,
          party_name: r.party_name,
          first_preference: r.first_preference,
          vote_share: r.first_preference
        }));

      const { error: resultsError } = await supabase
        .from('poll_party_results')
        .insert(resultsToInsert);

      if (resultsError) throw resultsError;

      alert(`✅ Poll successfully added! ID: ${poll.id}`);

      // Reset form
      setFormData({
        ...formData,
        poll_date: '',
        publication_date: '',
        source_url: '',
        article_title: '',
        notes: ''
      });

      setPartyResults(prev => prev.map(r => ({ ...r, first_preference: 0 })));

    } catch (error: any) {
      console.error('Error submitting poll:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const total = calculateTotal();
  const totalColor = Math.abs(total - 100) < 1 ? 'text-green-600' : 
                     Math.abs(total - 100) < 3 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-6">📊 Enter Poll Data</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Poll Metadata */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold mb-4">Poll Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Poll Source *
                </label>
                <select
                  name="source_id"
                  value={formData.source_id}
                  onChange={handleInputChange}
                  required
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select source...</option>
                  {sources.map(source => (
                    <option key={source.id} value={source.id}>
                      {source.name} ({source.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Poll Date *
                </label>
                <input
                  type="date"
                  name="poll_date"
                  value={formData.poll_date}
                  onChange={handleInputChange}
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Publication Date
                </label>
                <input
                  type="date"
                  name="publication_date"
                  value={formData.publication_date}
                  onChange={handleInputChange}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to use poll date
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Sample Size *
                </label>
                <input
                  type="number"
                  name="sample_size"
                  value={formData.sample_size}
                  onChange={handleInputChange}
                  required
                  min="100"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Margin of Error (%)
                </label>
                <input
                  type="number"
                  name="margin_of_error"
                  value={formData.margin_of_error}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  max="10"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Methodology
                </label>
                <select
                  name="methodology"
                  value={formData.methodology}
                  onChange={handleInputChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="online">Online</option>
                  <option value="phone">Phone</option>
                  <option value="face_to_face">Face-to-Face</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Scope *
                </label>
                <select
                  name="scope"
                  value={formData.scope}
                  onChange={handleInputChange}
                  required
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="national">National</option>
                  <option value="constituency">Constituency</option>
                  <option value="region">Region</option>
                </select>
              </div>

              {formData.scope === 'constituency' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Constituency Name
                  </label>
                  <input
                    type="text"
                    name="constituency"
                    value={formData.constituency}
                    onChange={handleInputChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., Dublin Central"
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Source URL
              </label>
              <input
                type="url"
                name="source_url"
                value={formData.source_url}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                placeholder="https://..."
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Article Title
              </label>
              <input
                type="text"
                name="article_title"
                value={formData.article_title}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Poll headline..."
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full border rounded px-3 py-2"
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          {/* Party Results */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Party Results</h2>
              <div className={`text-lg font-bold ${totalColor}`}>
                Total: {total.toFixed(1)}%
              </div>
            </div>

            <div className="space-y-3">
              {partyResults.map((result, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <select
                    value={result.party_id || ''}
                    onChange={(e) => {
                      const partyId = parseInt(e.target.value);
                      const party = parties.find(p => p.id === partyId);
                      setPartyResults(prev => {
                        const updated = [...prev];
                        updated[index].party_id = partyId;
                        updated[index].party_name = party?.name || '';
                        return updated;
                      });
                    }}
                    className="flex-1 border rounded px-3 py-2"
                  >
                    <option value="">Select party...</option>
                    {parties.map(party => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={result.first_preference || ''}
                    onChange={(e) => handlePartyResultChange(index, e.target.value)}
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0.0"
                    className="w-24 border rounded px-3 py-2 text-right"
                  />
                  <span className="text-gray-600">%</span>

                  <button
                    type="button"
                    onClick={() => removePartyResult(index)}
                    className="text-red-600 hover:text-red-800 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addPartyResult}
              className="mt-3 text-blue-600 hover:text-blue-800 text-sm"
            >
              + Add another party
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="submit"
              disabled={loading || !formData.poll_date || !formData.source_id}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : '✓ Submit Poll'}
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">💡 Tips:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Percentages should add up to approximately 100%</li>
          <li>• Enter decimals for precise values (e.g., 24.5)</li>
          <li>• Publication date defaults to poll date if not specified</li>
          <li>• Quality score is automatically set to 80 for manual entries</li>
          <li>• After submitting, run aggregation service to update trends</li>
        </ul>
      </div>
    </div>
  );
}

























