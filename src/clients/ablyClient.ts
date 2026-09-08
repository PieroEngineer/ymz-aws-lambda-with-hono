import { ablyKeyWS } from "../k.js";


export async function transmitViaAbly( channelName: string, eventName: string, dataPayload:  any, maxAttempts = 3 ){    /// Would it be a bad practice to pass the type as argument?

    if (!ablyKeyWS) {
        throw new Error("ABLY_API_KEY is not defined");
    }

    const [username, password] = ablyKeyWS.split(':');
    const credentials = btoa(`${username}:${password}`);

    const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`

    // We can extract this to an inline execution workflow
    let ablyDispatchSuccess = false;
    let attempts = 0;

    while (!ablyDispatchSuccess && attempts < maxAttempts) {  /// It would look better if this part is saved within a helper
        try {
        attempts++;
        const ablyResponse = await fetch(ablyEndpoint, {
            method: 'POST',
            headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            name: eventName,   // The targeted subscriber frequency path matching mock constraints
            data: dataPayload   // The exact TableRequestPayload DTO shape your staff app consumes
            })
        });

        if (ablyResponse.ok) {
            ablyDispatchSuccess = true;
            console.log(`📡 [Attempt ${attempts}] Successfully order preselection event to Ably channel: ${channelName}`);
            console.log(`📦  Order to send: ${JSON.stringify({name: eventName, data: dataPayload}, null, 2)}`);
            
        } else {
            console.warn(`⚠️ [Attempt ${attempts}] Mock Ably returned a status error code: ${ablyResponse.status}`);
        }
        } catch (netErr: any) {
        console.warn(`⚠️ [Attempt ${attempts}] Network failure transmitting data payload to mock Ably server: ${netErr.message}`);
        }
    }

    // Logging total failure fallback trace benchmarks if the mock server is down entirely
    if (!ablyDispatchSuccess) {
        console.error(`🚨 CRITICAL: Failed to stream real-time broadcast alert data past ${maxAttempts} attempts. Database state remains fully valid.`);
    }

    return ablyDispatchSuccess;
}

export async function transmitBatchPublishingViaAbly(dataPayload:  any ) {
    try {

        if (!ablyKeyWS) throw new Error("ABLY_API_KEY is not defined");
        
        // Ably uses Basic Auth with a Base64-encoded API key
        const encodedKey = Buffer.from(ablyKeyWS).toString('base64')

        // Single HTTP Round-Trip
        const response = await fetch('https://rest.ably.io/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${encodedKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataPayload)
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`🚩  Ably batch publish failed: ${response.status} ${errorText}`);
        }

        const data = await response.json()
        console.warn(`✅  Batch publish response: ${JSON.stringify(data, null, 2)}`);

    } catch (error: any) {
        throw new Error(`🚩  Failed to transmit batch publishing via Ably: ${error.message}`);
    }
}