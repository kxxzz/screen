void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    if(iMouse.z > 0.0) 
    {
        fragColor = vec4(iFrame, 0, 0, 1.0);
    }
    else
    {
        discard;
    }
}
