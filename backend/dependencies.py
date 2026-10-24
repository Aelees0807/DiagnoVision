import httpx
from fastapi import Header, HTTPException, Depends
from .config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

async def get_current_user(authorization: str = Header(None)):
    """
    Validate the Supabase JWT token using the Supabase Auth API.
    Returns the user payload (id, email) if valid, otherwise raises 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase credentials are not configured on the server."
        )

    # Call Supabase Auth endpoint to verify the token
    # We use httpx to make a request to /auth/v1/user
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": authorization
                },
                timeout=10.0
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail="Failed to communicate with Auth service.")
            
    if response.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_data = response.json()
    return {
        "id": user_data.get("id"),
        "email": user_data.get("email"),
    }

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """
    Validates that the current user has the 'admin' role in the profiles table.
    Uses the Supabase REST API with the service-role key to query the DB securely.
    Raises 403 if not admin.
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase service role key is not configured on the server."
        )

    user_id = current_user["id"]
    
    async with httpx.AsyncClient() as client:
        try:
            # Query the profiles table using PostgREST
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles",
                params={
                    "id": f"eq.{user_id}",
                    "select": "role"
                },
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
                },
                timeout=10.0
            )
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Failed to communicate with DB service.")
            
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Error fetching user profile.")
        
    data = response.json()
    if not data or len(data) == 0:
        raise HTTPException(status_code=403, detail="Profile not found.")
        
    role = data[0].get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required.")
        
    # Return user with added role
    return {**current_user, "role": role}
